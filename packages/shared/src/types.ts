// =============================================================
// clenjex — Shared Types
// EIP-712 TradeIntent + agent state types shared across agent,
// dashboard, indexer, and onchain packages.
// =============================================================

// ------- EIP-712 TradeIntent -------

/** EIP-712 typed data for a trade intent submitted to the Risk Router */
export interface TradeIntent {
  agentId: bigint; // NFT token ID from Identity Registry
  pair: string; // e.g. "BTC/USD"
  side: "buy" | "sell";
  amount: string; // decimal string e.g. "0.01"
  maxSlippage: number; // basis points e.g. 50 = 0.5%
  deadline: bigint; // unix timestamp
  nonce: bigint;
  chainId: bigint; // EIP-155 binding
}

/** EIP-712 domain for clenjex (used on all chains) */
export const TRADE_INTENT_DOMAIN_BASE = {
  name: "clenjex",
  version: "1",
} as const;

/** EIP-712 type definitions for TradeIntent */
export const TRADE_INTENT_TYPES = {
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

// ------- Market / Signal types -------

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  pair: string;
  side: "buy" | "sell" | "hold";
  confidence: number; // 0–100
  ema_short: number;
  ema_long: number;
  rsi: number;
  volume_zscore: number;
  reasoning: string;
}

// ------- Trade execution types -------

export type TradeLane = "kraken" | "defi";
export type TradeStatus =
  | "paper" // paper trade (logged only)
  | "live" // live Kraken order
  | "pending" // on-chain intent pending
  | "confirmed" // on-chain intent confirmed
  | "failed";

export interface Trade {
  id: string;
  timestamp: number;
  pair: string;
  side: "buy" | "sell";
  amount: string;
  price: string;
  status: TradeStatus;
  lane: TradeLane;
  // Kraken-specific
  krakenOrderId?: string;
  // DeFi-specific
  txHash?: string;
  intentHash?: string;
  // P&L (filled in later)
  pnl?: number;
  pnlPercent?: number;
}

// ------- Agent state -------

export interface AgentState {
  running: boolean;
  mode: "paper" | "live";
  totalTrades: number;
  openPositions: number;
  pnlUsd: number;
  pnlPercent: number;
  maxDrawdown: number;
  lastTradeAt?: number;
  // ERC-8004
  agentNFTId?: number;
  reputationScore?: number;
  validationStatus?: "pending" | "approved" | "rejected";
}

// ------- Chain configuration -------

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contracts: {
    agentIdentityRegistry?: `0x${string}`;
    reputationRegistry?: `0x${string}`;
    validationRegistry?: `0x${string}`;
    riskRouter?: `0x${string}`;
    safe?: `0x${string}`;
  };
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  base_sepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    contracts: {}, // filled in after deployment
  },
  base: {
    chainId: 8453,
    name: "Base Mainnet",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    contracts: {}, // filled in after deployment
  },
};
