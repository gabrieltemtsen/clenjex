/**
 * One-time script: whitelist trading pairs in RiskRouter
 * Run: tsx src/whitelist-pairs.ts
 * Requires: DEPLOYER_PRIVATE_KEY + BASE_SEPOLIA_RPC_URL + RISK_ROUTER_ADDRESS
 */
import { createWalletClient, createPublicClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const RISK_ROUTER_ABI = [
  {
    name: "whitelistPair",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "pair", type: "string" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "whitelistedPairs",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const PAIRS_TO_WHITELIST = ["BTC/USD", "ETH/USD", "SOL/USD"];

async function main() {
  const rawPk = process.env.DEPLOYER_PRIVATE_KEY ?? "";
  const pk = rawPk.startsWith("0x") ? rawPk : `0x${rawPk}`;
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
  const routerAddr = process.env.RISK_ROUTER_ADDRESS as Address;

  if (!pk || !routerAddr) {
    console.error("❌ DEPLOYER_PRIVATE_KEY and RISK_ROUTER_ADDRESS required");
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as Hex);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });

  console.log(`\nWhitelisting pairs on RiskRouter ${routerAddr}`);
  console.log(`Signer: ${account.address}\n`);

  for (const pair of PAIRS_TO_WHITELIST) {
    const current = await publicClient.readContract({
      address: routerAddr,
      abi: RISK_ROUTER_ABI,
      functionName: "whitelistedPairs",
      args: [pair],
    });

    if (current) {
      console.log(`✅ ${pair} — already whitelisted`);
      continue;
    }

    const txHash = await walletClient.writeContract({
      address: routerAddr,
      abi: RISK_ROUTER_ABI,
      functionName: "whitelistPair",
      args: [pair, true],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`${receipt.status === "success" ? "✅" : "❌"} ${pair} — tx: ${txHash}`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
