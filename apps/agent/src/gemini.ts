/**
 * Gemini 2.5 Flash — trade decision engine
 * Takes technical signals + recent candles and produces a final decision + reasoning
 */
import { GoogleGenAI } from "@google/genai";
import type { TradeSignal, OHLCV } from "./types.js";

let ai: GoogleGenAI | null = null;

function getAI(apiKey: string): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
}

export interface GeminiDecision {
  action: "buy" | "sell" | "hold";
  confidence: number;
  amount_pct: number;      // % of max position size to use (0-100)
  stop_loss_pct: number;
  take_profit_pct: number;
  reasoning: string;
}

export async function getTradeDecision(
  signal: TradeSignal,
  candles: OHLCV[],
  apiKey: string,
  pair: string
): Promise<GeminiDecision> {
  const ai = getAI(apiKey);
  const latestCandle = candles[candles.length - 1];
  const prev5 = candles.slice(-5).map(c =>
    `time=${new Date(c.timestamp).toISOString()} open=${c.open} high=${c.high} low=${c.low} close=${c.close} vol=${c.volume.toFixed(4)}`
  ).join("\n");

  const prompt = `You are a quantitative trading AI for clenjex, an autonomous crypto trading agent.

Current market data for ${pair}:
Latest price: ${latestCandle.close}
Recent 5 candles (1h):
${prev5}

Technical signals:
EMA(9): ${signal.ema_short.toFixed(2)}
EMA(21): ${signal.ema_long.toFixed(2)}
RSI(14): ${signal.rsi.toFixed(1)}
Volume z-score: ${signal.volume_zscore.toFixed(2)}
Technical signal: ${signal.side} (confidence: ${signal.confidence}%)
Signal reasoning: ${signal.reasoning}

Risk parameters:
- Max drawdown: 10%
- Max position: $500 USD equivalent
- Stop loss: 5% (default)
- Take profit: 10% (default)

Your task: make a final trading decision. Be conservative — only trade when the signal is clear.
Respond with valid JSON only, no markdown:
{
  "action": "buy" | "sell" | "hold",
  "confidence": <0-100>,
  "amount_pct": <0-100 percent of max position>,
  "stop_loss_pct": <1-10>,
  "take_profit_pct": <2-20>,
  "reasoning": "<one sentence>"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text ?? "{}";
    // Strip markdown code fences if present
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const decision = JSON.parse(clean) as GeminiDecision;
    return decision;
  } catch (err) {
    console.error("[gemini] failed:", err);
    return {
      action: "hold",
      confidence: 0,
      amount_pct: 0,
      stop_loss_pct: 5,
      take_profit_pct: 10,
      reasoning: "Gemini decision failed — defaulting to hold",
    };
  }
}
