# clenjex

Autonomous AI trading agent for Kraken (via Kraken CLI MCP) with optional on-chain execution (EIP-712 + Safe/EIP-1271).

## Goals
- Connect to Kraken via **Kraken CLI MCP server** (MCP-native tool interface)
- Run an agent loop (data → signals → decision → execution)
- Risk engine + logs + dashboard
- Optional on-chain lane: EIP-712 TradeIntents → Safe signing → Risk Router

## Repo structure (initial)
- `apps/agent` — agent runtime (TypeScript)
- `apps/dashboard` — Next.js dashboard (later)

## Secrets
Do **not** commit secrets. Use environment variables.

