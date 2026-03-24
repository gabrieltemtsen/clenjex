// Local type definitions (mirrors @clenjex/shared until workspace resolution is wired)

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
  confidence: number;
  ema_short: number;
  ema_long: number;
  rsi: number;
  volume_zscore: number;
  reasoning: string;
}

export interface Trade {
  id: string;
  timestamp: number;
  pair: string;
  side: "buy" | "sell";
  amount: string;
  price: string;
  status: "paper" | "live" | "pending" | "confirmed" | "failed";
  lane: "kraken" | "defi";
  txHash?: string;
  intentHash?: string;
  pnl?: number;
}

export interface AgentState {
  running: boolean;
  mode: "paper" | "live";
  totalTrades: number;
  openPositions: number;
  pnlUsd: number;
  pnlPercent: number;
  maxDrawdown: number;
  lastTradeAt?: number;
  agentNFTId?: number;
  reputationScore?: number;
}

export type TradeLane = "kraken" | "defi";
export type TradeStatus = "paper" | "live" | "pending" | "confirmed" | "failed";

export interface RiskConfig {
  maxDrawdownPct: number;      // e.g. 10 = 10% max drawdown → stop trading
  maxPositionSizeUsd: number;  // e.g. 500 = max $500 per trade
  stopLossPct: number;         // e.g. 5 = 5% stop loss per position
  takeProfitPct: number;       // e.g. 10 = 10% take profit
  minConfidence: number;       // e.g. 65 = only trade if signal confidence >= 65
  pairs: string[];             // tradeable pairs
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxDrawdownPct: 10,
  maxPositionSizeUsd: 500,
  stopLossPct: 5,
  takeProfitPct: 10,
  minConfidence: 65,
  pairs: ["XBTUSD", "XETHUSD", "SOLUSD"],
};
