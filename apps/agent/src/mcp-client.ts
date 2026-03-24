/**
 * Kraken CLI MCP Client
 * Spawns the Kraken CLI in MCP server mode (stdio transport) and exposes tools.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { OHLCV } from "./types.js";

export interface KrakenMCPClient {
  client: Client;
  listTools(): Promise<string[]>;
  getTicker(pair: string): Promise<Record<string, unknown>>;
  getOHLCV(pair: string, intervalMinutes: number, count?: number): Promise<OHLCV[]>;
  getOrderbook(pair: string, depth?: number): Promise<{ bids: [number, number][]; asks: [number, number][] }>;
  paperBuy(pair: string, volume: string, price?: number): Promise<Record<string, unknown>>;
  paperSell(pair: string, volume: string, price?: number): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

const KRAKEN_BIN = process.env.KRAKEN_BIN ?? "kraken";

export async function createKrakenMCPClient(opts: {
  apiKey?: string;
  apiSecret?: string;
  services?: string;
}): Promise<KrakenMCPClient> {
  const args = ["mcp", "--services", opts.services ?? "market,account,paper"];
  if (opts.apiKey) args.push("--api-key", opts.apiKey);

  const transport = new StdioClientTransport({
    command: KRAKEN_BIN,
    args,
    env: {
      ...process.env,
      ...(opts.apiSecret ? { KRAKEN_API_SECRET: opts.apiSecret } : {}),
    },
  });

  const client = new Client({ name: "clenjex", version: "0.1.0" });
  await client.connect(transport);

  return {
    client,

    async listTools(): Promise<string[]> {
      const result = await client.listTools();
      return result.tools.map((t) => t.name);
    },

    async getTicker(pair: string): Promise<Record<string, unknown>> {
      const result = await client.callTool({ name: "kraken_ticker", arguments: { pairs: [pair] } });
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? "{}";
      return JSON.parse(text);
    },

    async getOHLCV(pair: string, intervalMinutes = 60, count = 100): Promise<OHLCV[]> {
      const result = await client.callTool({
        name: "kraken_ohlc",
        arguments: { pair, interval: intervalMinutes },
      });
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? "{}";
      const raw = JSON.parse(text);
      // Kraken OHLC: response has one key with candle array + "last" key
      // Find the first key that maps to an array
      const key = Object.keys(raw).find(k => Array.isArray(raw[k])) ?? Object.keys(raw)[0];
      const candles: [number, string, string, string, string, string, string, number][] = raw[key];
      return candles.slice(-count).map(([time, open, high, low, close, , volume]) => ({
        timestamp: Number(time) * 1000,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: parseFloat(volume),
      }));
    },

    async getOrderbook(pair: string, depth = 10) {
      const result = await client.callTool({ name: "kraken_orderbook", arguments: { pair, count: depth } });
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? "{}";
      const raw = JSON.parse(text);
      const book = Object.values(raw)[0] as { bids: [string, string][]; asks: [string, string][] };
      return {
        bids: book.bids.map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
        asks: book.asks.map(([p, v]) => [parseFloat(p), parseFloat(v)] as [number, number]),
      };
    },

    async paperBuy(pair: string, volume: string, price?: number) {
      const args: Record<string, unknown> = { pair, volume, type: price ? "limit" : "market" };
      if (price) args.price = price.toString();
      const result = await client.callTool({ name: "kraken_paper_buy", arguments: args });
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? "{}";
      return JSON.parse(text);
    },

    async paperSell(pair: string, volume: string, price?: number) {
      const args: Record<string, unknown> = { pair, volume, type: price ? "limit" : "market" };
      if (price) args.price = price.toString();
      const result = await client.callTool({ name: "kraken_paper_sell", arguments: args });
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? "{}";
      return JSON.parse(text);
    },

    async close() {
      await client.close();
    },
  };
}
