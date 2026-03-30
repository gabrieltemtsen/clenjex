/**
 * ERC-8004 helpers (Identity/Reputation/Validation registries)
 *
 * We treat "validation artifacts" as JSON served by the dashboard.
 * The on-chain registry stores only a URI + response hash.
 */
import { createPublicClient, createWalletClient, http, type Address, type Hex, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const VALIDATION_REGISTRY_ABI = [
  {
    name: "submitValidation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "evidenceURI", type: "string" },
    ],
    outputs: [{ name: "validationId", type: "uint256" }],
  },
] as const;

const REPUTATION_REGISTRY_ABI = [
  {
    name: "submitFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
  },
] as const;

export type ERC8004Config = {
  rpcUrl: string;
  privateKey: Hex;
  agentNftId: bigint;
  validationRegistry?: Address;
  reputationRegistry?: Address;
};

export function erc8004ConfigFromEnv(env: {
  BASE_SEPOLIA_RPC_URL?: string;
  DEPLOYER_PRIVATE_KEY?: string;
  AGENT_NFT_ID?: string;
  VALIDATION_REGISTRY_ADDRESS?: string;
  REPUTATION_REGISTRY_ADDRESS?: string;
}): ERC8004Config | null {
  if (!env.DEPLOYER_PRIVATE_KEY || !env.AGENT_NFT_ID) return null;
  const privateKey = (env.DEPLOYER_PRIVATE_KEY.startsWith("0x")
    ? env.DEPLOYER_PRIVATE_KEY
    : `0x${env.DEPLOYER_PRIVATE_KEY}`) as Hex;
  return {
    rpcUrl: env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    privateKey,
    agentNftId: BigInt(env.AGENT_NFT_ID),
    validationRegistry: env.VALIDATION_REGISTRY_ADDRESS as Address | undefined,
    reputationRegistry: env.REPUTATION_REGISTRY_ADDRESS as Address | undefined,
  };
}

export async function submitValidationArtifact(
  cfg: ERC8004Config,
  evidenceURI: string,
  responseObject: unknown
): Promise<{ txHash: Hex } | null> {
  if (!cfg.validationRegistry) return null;

  const account = privateKeyToAccount(cfg.privateKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(cfg.rpcUrl) });

  // Store a response hash to satisfy ERC-8004 v1.2 expectations (even if we don't updateStatus here).
  const responseHash = keccak256(toHex(JSON.stringify(responseObject)));

  const txHash = await walletClient.writeContract({
    address: cfg.validationRegistry,
    abi: VALIDATION_REGISTRY_ABI,
    functionName: "submitValidation",
    args: [cfg.agentNftId, evidenceURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  if (receipt.status !== "success") throw new Error(`submitValidation reverted: ${txHash}`);

  // NOTE: responseHash is computed for later usage (updateStatus). We keep it in logs/artifact payload.
  console.log(`[erc8004] validation submitted tx=${txHash} responseHash=${responseHash}`);
  return { txHash };
}

export async function submitReputation(
  cfg: ERC8004Config,
  params: { value: bigint; decimals: number; tag: string; metadataURI: string }
): Promise<{ txHash: Hex } | null> {
  if (!cfg.reputationRegistry) return null;

  const account = privateKeyToAccount(cfg.privateKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(cfg.rpcUrl) });

  const txHash = await walletClient.writeContract({
    address: cfg.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "submitFeedback",
    args: [cfg.agentNftId, params.value as any, params.decimals, params.tag, params.metadataURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  if (receipt.status !== "success") throw new Error(`submitFeedback reverted: ${txHash}`);

  return { txHash };
}
