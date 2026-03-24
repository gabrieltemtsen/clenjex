/**
 * Technical signal computation
 * EMA crossover + RSI + volume z-score
 */
import type { OHLCV, TradeSignal } from "./types.js";

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0];
  for (const v of values) {
    prev = v * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function volumeZscore(volumes: number[], lookback = 20): number {
  const window = volumes.slice(-lookback);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const std = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length);
  if (std === 0) return 0;
  return (volumes[volumes.length - 1] - mean) / std;
}

export function computeSignal(candles: OHLCV[], pair: string): TradeSignal {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const rsiVal = rsi(closes);
  const volZ = volumeZscore(volumes);

  const shortEma = ema9[ema9.length - 1];
  const longEma = ema21[ema21.length - 1];
  const prevShort = ema9[ema9.length - 2];
  const prevLong = ema21[ema21.length - 2];

  // Signal logic
  const emaCrossUp = prevShort <= prevLong && shortEma > longEma;
  const emaCrossDown = prevShort >= prevLong && shortEma < longEma;
  const emaTrend = shortEma > longEma ? 1 : -1;

  let side: "buy" | "sell" | "hold" = "hold";
  let confidence = 0;

  if (emaCrossUp && rsiVal < 70 && volZ > 0.5) {
    side = "buy";
    confidence = Math.min(90, 55 + (70 - rsiVal) * 0.4 + volZ * 5);
  } else if (emaCrossDown && rsiVal > 30 && volZ > 0.5) {
    side = "sell";
    confidence = Math.min(90, 55 + (rsiVal - 30) * 0.4 + volZ * 5);
  } else if (emaTrend === 1 && rsiVal < 40 && volZ > 1) {
    side = "buy";
    confidence = 60 + volZ * 3;
  } else if (emaTrend === -1 && rsiVal > 60 && volZ > 1) {
    side = "sell";
    confidence = 60 + volZ * 3;
  }

  const reasoning = `EMA(9)=${shortEma.toFixed(2)} EMA(21)=${longEma.toFixed(2)} RSI=${rsiVal.toFixed(1)} VolZ=${volZ.toFixed(2)} → ${side} (${confidence.toFixed(0)}%)`;

  return {
    pair,
    side,
    confidence: Math.round(confidence),
    ema_short: shortEma,
    ema_long: longEma,
    rsi: rsiVal,
    volume_zscore: volZ,
    reasoning,
  };
}
