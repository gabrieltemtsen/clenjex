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
});

// Kraken canonical pair names (use kraken pairs command to verify)
const PAIRS = ["XXBTZUSD", "XETHZUSD", "SOLUSD"];
const INTERVAL_MINUTES = 60;

async function runCycle(
  env: z.infer<typeof Env>,
  risk: RiskConfig
) {
  console.log(`\n[${new Date().toISOString()}] ── Starting trade cycle ──`);

  // 1. Connect to Kraken CLI MCP
  console.log("[agent] Connecting to Kraken CLI MCP server...");
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
      const candles = await kraken.getOHLCV(pair, INTERVAL_MINUTES, 100);
      const latestPrice = candles[candles.length - 1].close;
      console.log(`[agent] ${pair} price: $${latestPrice.toFixed(2)} | candles: ${candles.length}`);

      // 3. Compute technical signals
      const signal = computeSignal(candles, pair);
      console.log(`[agent] Signal: ${signal.side} (${signal.confidence}%) | ${signal.reasoning}`);

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

        if (action === "hold") {
          console.log(`[agent] Gemini says hold — skipping`);
          continue;
        }
      }

      const isPaper = env.PAPER_TRADING === "true";
      const positionUsd = risk.maxPositionSizeUsd;
      const amount = (positionUsd / latestPrice).toFixed(8);

      // 6. Lane A: Kraken execution
      console.log(`[agent] Lane A (Kraken ${isPaper ? "PAPER" : "LIVE"}): ${action} ${amount} ${pair} @ $${latestPrice}`);
      if (isPaper) {
        const result = action === "buy"
          ? await kraken.paperBuy(pair, amount)
          : await kraken.paperSell(pair, amount);
        console.log(`[agent] ✅ Paper trade executed:`, JSON.stringify(result).slice(0, 120));
      }

      // 7. Lane B: ERC-8004 DeFi — build + sign TradeIntent
      if (env.SAFE_ADDRESS && env.RISK_ROUTER_ADDRESS && env.DEPLOYER_PRIVATE_KEY) {
        console.log(`[agent] Lane B (DeFi/ERC-8004): building EIP-712 TradeIntent...`);
        // TODO: wire viem + Safe signing → Risk Router submitIntent()
        console.log(`[agent] Lane B: TradeIntent submission pending viem integration`);
      } else {
        console.log(`[agent] Lane B: skipped (SAFE_ADDRESS or RISK_ROUTER_ADDRESS not set)`);
      }

      console.log(`[agent] ✓ Cycle complete for ${pair}`);
    } catch (err) {
      console.error(`[agent] Error processing ${pair}:`, err);
    }
  }

  await kraken.close();
}

async function main() {
  const env = Env.parse(process.env);
  const risk: RiskConfig = DEFAULT_RISK_CONFIG;
  risk.pairs = PAIRS;

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
  await runCycle(env, risk);

  const intervalMs = Number(env.TRADE_INTERVAL_MS);
  console.log(`\n[agent] Next cycle in ${intervalMs / 60000} minutes...`);

  setInterval(async () => {
    await runCycle(env, risk).catch(console.error);
  }, intervalMs);
}

main().catch((err) => {
  console.error("[clenjex] fatal:", err);
  process.exit(1);
});
