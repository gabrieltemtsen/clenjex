/**
 * Lane B — On-chain EIP-712 TradeIntent submission
 *
 * Flow:
 *   1. Build TradeIntent struct (pair, side, amount, deadline, nonce)
 *   2. Sign with EIP-712 using deployer private key (viem)
 *   3. Submit to RiskRouter.submitIntent() on Base Sepolia
 *   4. Return intentHash + txHash for DB recording
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
  parseEther,
  hashTypedData,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ── ABI (minimal — only what we need) ─────────────────────────
const RISK_ROUTER_ABI = [
  {
    name: "submitIntent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "intent",
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "pair", type: "string" },
          { name: "side", type: "string" },
          { name: "amount", type: "string" },
          { name: "maxSlippage", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "chainId", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "intentHash", type: "bytes32" }],
  },
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "whitelistedPairs",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ── EIP-712 domain + types ─────────────────────────────────────
const EIP712_DOMAIN = {
  name: "clenjex",
  version: "1",
  chainId: BigInt(baseSepolia.id),
  verifyingContract: undefined as Address | undefined,
} as const;

const TRADE_INTENT_TYPES = {
  TradeIntent: [
    { name: "agentId", type: "uint256" },
    { name: "pair", type: "string" },
    { name: "side", type: "string" },
    { name: "amount", type: "string" },
    { name: "maxSlippage", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "chainId", type: "uint256" },
  ],
} as const;

// ── Config ─────────────────────────────────────────────────────
export interface LaneBConfig {
  privateKey: Hex;
  rpcUrl: string;
  riskRouterAddress: Address;
  agentNftId: bigint;
  safeAddress?: Address; // optional — if set, sends via Safe
}

export interface LaneBResult {
  intentHash: Hex;
  txHash: Hex;
  nonce: bigint;
}

// ── Map Kraken pair names → human readable ─────────────────────
// Risk Router uses human-readable pairs (must match whitelisted strings)
export function krakenToDisplayPair(krakenPair: string): string {
  const map: Record<string, string> = {
    XXBTZUSD: "BTC/USD",
    XETHZUSD: "ETH/USD",
    SOLUSD: "SOL/USD",
    BTCUSD: "BTC/USD",
    ETHUSD: "ETH/USD",
  };
  return map[krakenPair] ?? krakenPair;
}

// ── Main submit function ───────────────────────────────────────
export async function submitTradeIntent(
  cfg: LaneBConfig,
  trade: {
    pair: string; // Kraken pair name (will be converted)
    side: "buy" | "sell";
    amount: string; // decimal string e.g. "0.001"
  }
): Promise<LaneBResult> {
  const account = privateKeyToAccount(cfg.privateKey);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(cfg.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(cfg.rpcUrl),
  });

  const displayPair = krakenToDisplayPair(trade.pair);

  // 1. Get current nonce
  const nonce = await publicClient.readContract({
    address: cfg.riskRouterAddress,
    abi: RISK_ROUTER_ABI,
    functionName: "getNonce",
    args: [account.address],
  });

  // 2. Check pair is whitelisted
  const isWhitelisted = await publicClient.readContract({
    address: cfg.riskRouterAddress,
    abi: RISK_ROUTER_ABI,
    functionName: "whitelistedPairs",
    args: [displayPair],
  });

  if (!isWhitelisted) {
    throw new Error(
      `Pair ${displayPair} is not whitelisted in RiskRouter. ` +
      `Run the whitelist-pairs script first.`
    );
  }

  // 3. Build intent
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5min window
  const intent = {
    agentId: cfg.agentNftId,
    pair: displayPair,
    side: trade.side,
    amount: trade.amount,
    maxSlippage: BigInt(50), // 0.5%
    deadline,
    nonce,
    chainId: BigInt(baseSepolia.id),
  };

  // 4. Sign EIP-712
  const domain = {
    ...EIP712_DOMAIN,
    verifyingContract: cfg.riskRouterAddress,
  };

  const signature = await walletClient.signTypedData({
    domain,
    types: TRADE_INTENT_TYPES,
    primaryType: "TradeIntent",
    message: intent,
  });

  // 5. Submit to RiskRouter
  const txHash = await walletClient.writeContract({
    address: cfg.riskRouterAddress,
    abi: RISK_ROUTER_ABI,
    functionName: "submitIntent",
    args: [intent, signature],
  });

  // 6. Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });

  if (receipt.status !== "success") {
    throw new Error(`Lane B tx reverted: ${txHash}`);
  }

  // 7. Extract intentHash from logs (first topic of TradeIntentSubmitted)
  const log = receipt.logs[0];
  const intentHash = (log?.topics?.[3] ?? "0x") as Hex;

  console.log(`[lane-b] ✅ Intent submitted | tx: ${txHash} | hash: ${intentHash}`);

  return { intentHash, txHash, nonce };
}

// ── Helper: build LaneBConfig from env vars ────────────────────
export function laneBConfigFromEnv(env: {
  DEPLOYER_PRIVATE_KEY?: string;
  BASE_SEPOLIA_RPC_URL?: string;
  RISK_ROUTER_ADDRESS?: string;
  AGENT_NFT_ID?: string;
  SAFE_ADDRESS?: string;
}): LaneBConfig | null {
  if (!env.DEPLOYER_PRIVATE_KEY || !env.RISK_ROUTER_ADDRESS) return null;
  const rawPk = env.DEPLOYER_PRIVATE_KEY;
  const privateKey = (rawPk.startsWith("0x") ? rawPk : `0x${rawPk}`) as Hex;
  return {
    privateKey,
    rpcUrl: env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    riskRouterAddress: env.RISK_ROUTER_ADDRESS as Address,
    agentNftId: BigInt(env.AGENT_NFT_ID ?? "0"),
    safeAddress: env.SAFE_ADDRESS as Address | undefined,
  };
}
