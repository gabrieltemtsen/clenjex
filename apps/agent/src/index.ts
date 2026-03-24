/**
 * clenjex — Autonomous AI Trading Agent
 *
 * Dual-lane architecture:
 *   Lane A (Kraken): Kraken CLI MCP server → market data → signal → Kraken order
 *   Lane B (DeFi):   Same signal → EIP-712 TradeIntent → Safe signing → Risk Router on Base Sepolia
 *
 * Pipeline:
 *   1. Connect to Kraken CLI MCP server
 *   2. Fetch OHLCV + orderbook via MCP tools
 *   3. Compute signals: EMA crossover, RSI, volume z-score
 *   4. Gemini 2.5 Flash: generate decision + reasoning
 *   5. Risk engine: check drawdown, position size, stop-loss
 *   6. Execute:
 *      A) Kraken lane → paper/live order via Kraken CLI
 *      B) DeFi lane → sign TradeIntent (EIP-712, EIP-1271 via Safe) → submit to RiskRouter
 *   7. Record feedback to ReputationRegistry on-chain
 *   8. Emit trades to dashboard via API
 */

import { z } from "zod";

const Env = z.object({
  // Kraken API
  KRAKEN_API_KEY: z.string().optional(),
  KRAKEN_API_SECRET: z.string().optional(),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),

  // EVM / DeFi lane
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  BASE_SEPOLIA_RPC_URL: z.string().default("https://sepolia.base.org"),
  AGENT_NFT_ID: z.string().optional(),
  SAFE_ADDRESS: z.string().optional(),
  RISK_ROUTER_ADDRESS: z.string().optional(),
  IDENTITY_REGISTRY_ADDRESS: z.string().optional(),
  REPUTATION_REGISTRY_ADDRESS: z.string().optional(),
  VALIDATION_REGISTRY_ADDRESS: z.string().optional(),

  // Config
  PAPER_TRADING: z.string().default("true"),
  TRADE_INTERVAL_MS: z.string().default("300000"), // 5 minutes
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().optional(),

  // Notifications
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

async function main() {
  const env = Env.parse(process.env);
  const isPaper = env.PAPER_TRADING === "true";

  console.log("╔══════════════════════════════════════╗");
  console.log("║           clenjex agent              ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Mode:          ${isPaper ? "📋 PAPER TRADING" : "🔴 LIVE TRADING"}`);
  console.log(`Interval:      ${Number(env.TRADE_INTERVAL_MS) / 1000}s`);
  console.log(`Kraken keys:   ${Boolean(env.KRAKEN_API_KEY) ? "✅" : "❌"}`);
  console.log(`Gemini:        ${Boolean(env.GEMINI_API_KEY) ? "✅" : "❌"}`);
  console.log(`Safe wallet:   ${env.SAFE_ADDRESS ?? "❌ NOT SET"}`);
  console.log(`Risk Router:   ${env.RISK_ROUTER_ADDRESS ?? "❌ NOT SET"}`);
  console.log(`Agent NFT ID:  ${env.AGENT_NFT_ID ?? "❌ NOT REGISTERED YET"}`);
  console.log(`DB:            ${env.DATABASE_URL ? "✅" : "❌ not set (log-only)"}`);
  console.log("");

  console.log("📋 Build milestones:");
  const milestones = [
    "[ ] Connect to Kraken CLI MCP server",
    "[ ] Fetch OHLCV + orderbook from MCP",
    "[ ] Compute EMA + RSI + volume signals",
    "[ ] Gemini 2.5 Flash decision generation",
    "[ ] Risk engine (drawdown, stop-loss, position sizing)",
    "[ ] Kraken lane paper execution",
    "[ ] Deploy Safe on Base Sepolia",
    "[ ] Register Agent Identity NFT (ERC-8004)",
    "[ ] Build + sign EIP-712 TradeIntent",
    "[ ] Submit to RiskRouter (EIP-1271 via Safe)",
    "[ ] Submit reputation feedback on-chain",
    "[ ] Dashboard live data feed",
    "[ ] Switch to live trading (March 30)",
  ];
  milestones.forEach((m) => console.log(" ", m));
}

main().catch((err) => {
  console.error("[clenjex] fatal:", err);
  process.exit(1);
});
