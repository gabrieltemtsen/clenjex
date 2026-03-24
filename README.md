# clenjex

Autonomous AI trading agent for the Kraken + Surge hackathon.

## Goals
- Connect to Kraken via **Kraken CLI MCP server** (MCP-native tool interface)
- Run an agent loop (data → signals → decision → execution)
- Risk engine + logs + minimal dashboard
- Social engagement autoposting via x-build-in-public

## Repo structure (initial)
- `apps/agent` — agent runtime (TypeScript)
- `apps/dashboard` — Next.js dashboard (later)

## Secrets
Do **not** commit secrets. Use environment variables.

