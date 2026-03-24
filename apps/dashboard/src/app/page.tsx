"use client";

import { useEffect, useMemo, useState } from "react";

type PairState = {
  pair: string;
  price: string | null;
  signal_side: string | null;
  signal_confidence: number | null;
  signal_reasoning: string | null;
  last_run_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type TradeRow = {
  id: number;
  created_at: string;
  pair: string;
  side: string;
  amount: string | null;
  price: string | null;
  lane: string;
  status: string;
};

export default function Home() {
  const [state, setState] = useState<PairState[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setErr(null);
      const [s, t] = await Promise.all([
        fetch("/api/state").then((r) => r.json()),
        fetch("/api/trades?limit=100").then((r) => r.json()),
      ]);
      setState(s.rows ?? []);
      setTrades(t.rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  const totals = useMemo(() => {
    return {
      trades: trades.length,
      lastTradeAt: trades[0]?.created_at ?? null,
    };
  }, [trades]);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">clenjex</h1>
            <p className="text-gray-400 text-sm mt-1">Autonomous trading agent</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              className="text-sm bg-gray-900 border border-gray-800 px-3 py-2 rounded-lg hover:bg-gray-800"
              onClick={refresh}
            >
              Refresh
            </button>
          </div>
        </div>

        {err ? (
          <div className="mb-6 bg-red-950/40 border border-red-900 text-red-200 rounded-xl p-4">
            Dashboard error: {err}
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Trades (recent)" value={String(totals.trades)} sub="last 100" />
          <Stat label="Last trade" value={totals.lastTradeAt ? new Date(totals.lastTradeAt).toLocaleString() : "—"} sub="" />
          <Stat label="Pairs tracked" value={String(state.length)} sub="" />
          <Stat label="DB" value={"connected"} sub={"DATABASE_URL"} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card title="Kraken lane" subtitle="Market data + execution via Kraken CLI MCP">
            <div className="text-xs text-gray-400">Live. See per-pair state below.</div>
          </Card>
          <Card title="On-chain lane" subtitle="Safe (EIP-1271) + Risk Router (EIP-712)">
            <div className="text-xs text-gray-400">Coming online next. Contracts already deployed.</div>
          </Card>
        </div>

        <Card title="Pairs" subtitle="Latest signal + health">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="py-3 pr-4 text-left">Pair</th>
                  <th className="py-3 pr-4 text-left">Price</th>
                  <th className="py-3 pr-4 text-left">Signal</th>
                  <th className="py-3 pr-4 text-left">Confidence</th>
                  <th className="py-3 pr-4 text-left">Last run</th>
                  <th className="py-3 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {state.map((r) => (
                  <tr key={r.pair} className="border-b border-gray-900">
                    <td className="py-3 pr-4 font-medium">{r.pair}</td>
                    <td className="py-3 pr-4">{r.price ? `$${Number(r.price).toFixed(2)}` : "—"}</td>
                    <td className="py-3 pr-4">
                      <span className="px-2 py-1 rounded bg-gray-900 border border-gray-800">
                        {r.signal_side ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{r.signal_confidence ?? "—"}</td>
                    <td className="py-3 pr-4">{r.last_run_at ? new Date(r.last_run_at).toLocaleTimeString() : "—"}</td>
                    <td className="py-3 text-red-300">{r.last_error ? r.last_error.slice(0, 90) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="h-6" />

        <Card title="Trade log" subtitle="Only executed trades (paper/live)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="py-3 pr-4 text-left">Time</th>
                  <th className="py-3 pr-4 text-left">Pair</th>
                  <th className="py-3 pr-4 text-left">Side</th>
                  <th className="py-3 pr-4 text-left">Amount</th>
                  <th className="py-3 pr-4 text-left">Price</th>
                  <th className="py-3 pr-4 text-left">Lane</th>
                  <th className="py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No trades yet.
                    </td>
                  </tr>
                ) : (
                  trades.map((t) => (
                    <tr key={t.id} className="border-b border-gray-900">
                      <td className="py-3 pr-4 text-gray-400">
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 font-medium">{t.pair}</td>
                      <td className="py-3 pr-4">{t.side}</td>
                      <td className="py-3 pr-4">{t.amount ?? "—"}</td>
                      <td className="py-3 pr-4">{t.price ? `$${Number(t.price).toFixed(2)}` : "—"}</td>
                      <td className="py-3 pr-4">{t.lane}</td>
                      <td className="py-3">{t.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle ? <p className="text-gray-400 text-sm mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-100">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{sub}</p>
    </div>
  );
}
