/**
 * clenjex — Autonomous AI Trading Agent
 *
 * Dual-lane architecture:
 *   Lane A (Kraken): Kraken CLI MCP server → market data → signal → paper/live order
 *   Lane B (DeFi):   Same signal → EIP-712 TradeIntent → Safe (EIP-1271) → Risk Router
 */
import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Auto-load .env from apps/agent/.env (works locally; Railway uses real env vars)
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });
import { createKrakenMCPClient } from "./mcp-client.js";
import { computeSignal } from "./signals.js";
import { getTradeDecision } from "./gemini.js";
import type { RiskConfig } from "./types.js";
import { DEFAULT_RISK_CONFIG } from "./types.js";
import { submitTradeIntent, laneBConfigFromEnv, krakenToDisplayPair } from "./lane-b.js";

const Env = z.object({
  KRAKEN_API_KEY: z.string().optional(),
  KRAKEN_API_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  BASE_SEPOLIA_RPC_URL: z.string().default("https://sepolia.base.org"),
  AGENT_NFT_ID: z.string().optional(),
  SAFE_ADDRESS: z.string().optional(),
  RISK_ROUTER_ADDRESS: z.string().optional(),
  PAPER_TRADING: z.string().default("true"),
  TRADE_INTERVAL_MS: z.string().default("300000"),
  LOG_LEVEL: z.string().default("info"),
  KRAKEN_BIN: z.string().default("kraken"),

  // DB
  DATABASE_URL: z.string().optional(),

  // Tuning
  MIN_CONFIDENCE: z.string().optional(),
  POSITION_SIZE_USD: z.string().optional(),
  CANDLE_INTERVAL_MINUTES: z.string().optional(),
});

// Kraken canonical pair names (use kraken pairs command to verify)
const PAIRS = ["XXBTZUSD", "XETHZUSD", "SOLUSD"];
const DEFAULT_INTERVAL_MINUTES = 60;

import { createPool, ensureSchema, insertDecision, insertTrade, upsertPairState } from "../../../packages/shared/src/db.js";

async function runCycle(
  env: z.infer<typeof Env>,
  risk: RiskConfig,
  deps: { pool?: ReturnType<typeof createPool> }
) {
  console.log(`\n[${new Date().toISOString()}] ── Starting trade cycle ──`);

  // 1. Connect to Kraken CLI MCP
  console.log("[agent] Connecting to Kraken CLI MCP server...");
  const intervalMinutes = Number(env.CANDLE_INTERVAL_MINUTES ?? DEFAULT_INTERVAL_MINUTES);

  const kraken = await createKrakenMCPClient({
    apiKey: env.KRAKEN_API_KEY,
    apiSecret: env.KRAKEN_API_SECRET,
    services: env.KRAKEN_API_KEY ? "market,account,paper" : "market",
  });

  const tools = await kraken.listTools();
  console.log(`[agent] MCP connected — ${tools.length} tools available`);

  for (const pair of risk.pairs) {
    try {
      console.log(`\n[agent] Processing ${pair}...`);

      // 2. Fetch market data
      const candles = await kraken.getOHLCV(pair, intervalMinutes, 100);
      const latestPrice = candles[candles.length - 1].close;
      console.log(`[agent] ${pair} price: $${latestPrice.toFixed(2)} | candles: ${candles.length}`);

      // 3. Compute technical signals
      const signal = computeSignal(candles, pair);
      console.log(`[agent] Signal: ${signal.side} (${signal.confidence}%) | ${signal.reasoning}`);

      // Always upsert latest state
      if (deps.pool) {
        await upsertPairState(deps.pool, {
          pair,
          price: latestPrice,
          signal_side: signal.side,
          signal_confidence: signal.confidence,
          signal_reasoning: signal.reasoning,
          last_run_at: new Date(),
          last_error: null,
        });
      }

      // 4. Risk gate: skip if confidence too low
      if (signal.side === "hold" || signal.confidence < risk.minConfidence) {
        console.log(`[agent] Signal below confidence threshold (${risk.minConfidence}%) — skipping`);
        continue;
      }

      // 5. Gemini decision (if API key available)
      let action = signal.side as "buy" | "sell" | "hold";
      let reasoning = signal.reasoning;

      if (env.GEMINI_API_KEY) {
        const decision = await getTradeDecision(signal, candles, env.GEMINI_API_KEY, pair);
        action = decision.action;
        reasoning = decision.reasoning;
        console.log(`[agent] Gemini decision: ${action} (${decision.confidence}%) — ${reasoning}`);

        if (action !== "hold" && deps.pool) {
          await insertDecision(deps.pool, {
            pair,
            action,
            confidence: decision.confidence,
            amount_pct: decision.amount_pct,
            stop_loss_pct: decision.stop_loss_pct,
            take_profit_pct: decision.take_profit_pct,
            reasoning: decision.reasoning,
            raw: decision,
          });
        }

        if (action === "hold") {
          console.log(`[agent] Gemini says hold — skipping`);
          continue;
        }
      }

      const isPaper = env.PAPER_TRADING === "true";
      const positionUsd = Number(env.POSITION_SIZE_USD ?? risk.maxPositionSizeUsd);
      const amount = (positionUsd / latestPrice).toFixed(8);

      // 6. Lane A: Kraken execution
      console.log(`[agent] Lane A (Kraken ${isPaper ? "PAPER" : "LIVE"}): ${action} ${amount} ${pair} @ $${latestPrice}`);
      if (isPaper) {
        const result = action === "buy"
          ? await kraken.paperBuy(pair, amount)
          : await kraken.paperSell(pair, amount);
        console.log(`[agent] ✅ Paper trade executed:`, JSON.stringify(result).slice(0, 120));

        if (deps.pool) {
          await insertTrade(deps.pool, {
            pair,
            side: action,
            amount,
            price: latestPrice,
            lane: "kraken",
            status: "paper",
          });
        }
      }

      // 7. Lane B: EIP-712 TradeIntent → RiskRouter on Base Sepolia
      const laneBCfg = laneBConfigFromEnv(env);
      if (laneBCfg) {
        try {
          console.log(`[agent] Lane B (on-chain): submitting EIP-712 TradeIntent for ${pair}...`);
          const result = await submitTradeIntent(laneBCfg, {
            pair,
            side: action,
            amount,
          });
          console.log(`[agent] Lane B ✅ intentHash=${result.intentHash} tx=${result.txHash}`);

          if (deps.pool) {
            await insertTrade(deps.pool, {
              pair: krakenToDisplayPair(pair),
              side: action,
              amount,
              price: latestPrice,
              lane: "defi",
              status: "confirmed",
              intent_hash: result.intentHash,
              tx_hash: result.txHash,
            });
          }
        } catch (lbErr) {
          const msg = lbErr instanceof Error ? lbErr.message : String(lbErr);
          console.warn(`[agent] Lane B ⚠ skipped: ${msg}`);
        }
      } else {
        console.log(`[agent] Lane B: skipped (DEPLOYER_PRIVATE_KEY or RISK_ROUTER_ADDRESS not set)`);
      }

      console.log(`[agent] ✓ Cycle complete for ${pair}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agent] Error processing ${pair}:`, err);
      if (deps.pool) {
        await upsertPairState(deps.pool, {
          pair,
          last_run_at: new Date(),
          last_error: msg,
        });
      }
    }
  }

  await kraken.close();
}

async function main() {
  const env = Env.parse(process.env);
  const risk: RiskConfig = DEFAULT_RISK_CONFIG;
  risk.pairs = PAIRS;
  if (env.MIN_CONFIDENCE) risk.minConfidence = Number(env.MIN_CONFIDENCE);

  const pool = env.DATABASE_URL ? createPool(env.DATABASE_URL) : undefined;
  if (pool) {
    await ensureSchema(pool);
    console.log("[agent] DB connected + schema ensured");
  }

  console.log("╔══════════════════════════════════════╗");
  console.log("║           clenjex agent  ⚡          ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Mode:         ${env.PAPER_TRADING === "true" ? "📋 PAPER" : "🔴 LIVE"}`);
  console.log(`Pairs:        ${PAIRS.join(", ")}`);
  console.log(`Interval:     ${Number(env.TRADE_INTERVAL_MS) / 60000}min`);
  console.log(`Kraken keys:  ${env.KRAKEN_API_KEY ? "✅" : "❌ (market data only)"}`);
  console.log(`Gemini:       ${env.GEMINI_API_KEY ? "✅" : "❌"}`);
  console.log(`Safe:         ${env.SAFE_ADDRESS ?? "❌"}`);
  console.log(`Risk Router:  ${env.RISK_ROUTER_ADDRESS ?? "❌"}`);
  console.log(`Agent NFT:    ${env.AGENT_NFT_ID ?? "❌"}`);
  console.log("");

  // Run first cycle immediately, then on interval
  await runCycle(env, risk, { pool });

  const intervalMs = Number(env.TRADE_INTERVAL_MS);
  console.log(`\n[agent] Next cycle in ${intervalMs / 60000} minutes...`);

  setInterval(async () => {
    await runCycle(env, risk, { pool }).catch(console.error);
  }, intervalMs);
}

main().catch((err) => {
  console.error("[clenjex] fatal:", err);
  process.exit(1);
});
