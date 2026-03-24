import { z } from "zod";

// Placeholder entrypoint.
// Next milestone: connect to Kraken CLI MCP server and list tools.

const Env = z.object({
  // Example env vars; names may change once we confirm how you want to store keys.
  KRAKEN_API_KEY: z.string().optional(),
  KRAKEN_API_SECRET: z.string().optional()
});

function main() {
  const env = Env.parse(process.env);
  console.log("clenjex agent starting...");
  console.log("keys present:", {
    hasKey: Boolean(env.KRAKEN_API_KEY),
    hasSecret: Boolean(env.KRAKEN_API_SECRET)
  });
  console.log("TODO: connect to Kraken CLI MCP server and fetch market data");
}

main();
