/**
 * clenjex on-chain event indexer
 *
 * Subscribes to events from:
 *   - AgentIdentityRegistry  → AgentRegistered
 *   - ReputationRegistry     → NewFeedback
 *   - ValidationRegistry     → ValidationSubmitted, ValidationStatusUpdated
 *   - RiskRouter             → TradeIntentSubmitted
 *
 * Writes indexed events to Postgres (DATABASE_URL) for the dashboard to consume.
 *
 * TODO milestones:
 *   1. Wire viem public client to Base Sepolia RPC
 *   2. Load contract addresses from deployments.json
 *   3. watchContractEvent for each registry
 *   4. Write events to Postgres
 */

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
const dbUrl = process.env.DATABASE_URL;

console.log("[indexer] clenjex on-chain event indexer");
console.log("[indexer] RPC:", rpcUrl);
console.log("[indexer] DB:", dbUrl ? "configured" : "NOT SET — will log only");
console.log("[indexer] TODO: load deployments.json + subscribe to contract events");
