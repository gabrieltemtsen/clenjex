"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────
type PairState = {
  pair: string;
  price: string | null;
  signal_side: "buy" | "sell" | "hold" | null;
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
  side: "buy" | "sell";
  amount: string | null;
  price: string | null;
  lane: string;
  status: string;
  order_id: string | null;
  pnl: string | null;
  pnl_percent: string | null;
  intent_hash: string | null;
  tx_hash: string | null;
};

type DecisionRow = {
  id: number;
  created_at: string;
  pair: string;
  action: string;
  confidence: number | null;
  amount_pct: number | null;
  stop_loss_pct: string | null;
  take_profit_pct: string | null;
  reasoning: string | null;
};

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: string | number | null, decimals = 2) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(decimals);
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Sub-components ────────────────────────────────────────────
function Badge({ label, variant }: { label: string; variant: "buy" | "sell" | "hold" | "paper" | "live" | "confirmed" | "pending" | "failed" | "default" }) {
  const styles: Record<string, string> = {
    buy: "bg-emerald-950 text-emerald-300 border-emerald-800",
    sell: "bg-red-950 text-red-300 border-red-800",
    hold: "bg-gray-800 text-gray-300 border-gray-700",
    paper: "bg-gray-800 text-gray-400 border-gray-700",
    live: "bg-blue-950 text-blue-300 border-blue-800",
    confirmed: "bg-emerald-950 text-emerald-300 border-emerald-800",
    pending: "bg-amber-950 text-amber-300 border-amber-800",
    failed: "bg-red-950 text-red-300 border-red-800",
    default: "bg-gray-800 text-gray-400 border-gray-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${styles[variant] ?? styles.default}`}>
      {label.toUpperCase()}
    </span>
  );
}

function ConfBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-600">—</span>;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const [pairStates, setPairStates] = useState<PairState[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"trades" | "decisions">("trades");

  const refresh = useCallback(async () => {
    try {
      setErr(null);
      const [s, t, d] = await Promise.all([
        fetch("/api/state").then((r) => r.json()),
        fetch("/api/trades?limit=100").then((r) => r.json()),
        fetch("/api/decisions?limit=50").then((r) => r.json()),
      ]);
      setPairStates(s.rows ?? []);
      setTrades(t.rows ?? []);
      setDecisions(d.rows ?? []);
      setLastRefresh(new Date());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const stats = useMemo(() => {
    const totalPnl = trades.reduce((acc, t) => acc + (t.pnl ? Number(t.pnl) : 0), 0);
    const wins = trades.filter((t) => t.pnl && Number(t.pnl) > 0).length;
    const losses = trades.filter((t) => t.pnl && Number(t.pnl) < 0).length;
    return {
      totalTrades: trades.length,
      pnl: totalPnl,
      pnlStr: (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(2),
      wins,
      losses,
      lastTrade: trades[0]?.created_at ?? null,
    };
  }, [trades]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Connecting to database…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ─────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">cx</div>
            <div>
              <h1 className="font-bold text-lg leading-none">clenjex</h1>
              <p className="text-xs text-gray-500">Autonomous Trading Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastRefresh && (
              <span className="text-xs text-gray-600 hidden sm:block">
                Updated {shortTime(lastRefresh.toISOString())}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
            <button
              onClick={refresh}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── Error Banner ────────────────────────── */}
        {err && (
          <div className="bg-red-950/40 border border-red-900/60 text-red-300 rounded-xl px-5 py-4 text-sm">
            <span className="font-medium">Error:</span> {err}
          </div>
        )}

        {/* ── Stats ───────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Trades" value={String(stats.totalTrades)} sub="last 100 loaded" />
          <StatCard
            label="Total P&L"
            value={`$${stats.pnlStr}`}
            sub={`${stats.wins}W / ${stats.losses}L`}
            accent={stats.pnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard label="Pairs Tracked" value={String(pairStates.length)} sub="with live signals" />
          <StatCard
            label="Last Trade"
            value={stats.lastTrade ? timeAgo(stats.lastTrade) : "—"}
            sub={stats.lastTrade ? new Date(stats.lastTrade).toLocaleDateString() : "no trades yet"}
          />
        </div>

        {/* ── Pair State Table ─────────────────────── */}
        <Card
          title="Pair Signals"
          subtitle="Live market state — refreshes every 8s"
          right={
            <span className="text-xs text-gray-600">{pairStates.length} pairs</span>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3 text-left">Pair</th>
                <th className="px-6 py-3 text-left">Price</th>
                <th className="px-6 py-3 text-left">Signal</th>
                <th className="px-6 py-3 text-left">Confidence</th>
                <th className="px-6 py-3 text-left">Last Run</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {pairStates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-600 text-sm">
                    No pairs tracked yet. Agent will populate this once running.
                  </td>
                </tr>
              ) : (
                pairStates.map((p) => (
                  <tr key={p.pair} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-3 font-mono font-medium text-white">{p.pair}</td>
                    <td className="px-6 py-3 font-mono text-gray-300">
                      {p.price ? `$${fmt(p.price)}` : "—"}
                    </td>
                    <td className="px-6 py-3">
                      {p.signal_side ? (
                        <Badge label={p.signal_side} variant={p.signal_side as "buy" | "sell" | "hold"} />
                      ) : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <ConfBar value={p.signal_confidence} />
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs">
                      {timeAgo(p.last_run_at)}
                    </td>
                    <td className="px-6 py-3">
                      {p.last_error ? (
                        <span className="text-xs text-red-400 truncate max-w-[200px] block" title={p.last_error}>
                          ⚠ {p.last_error.slice(0, 60)}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        {/* ── Lanes Overview ───────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center text-blue-400 text-sm font-bold">K</div>
              <div>
                <p className="font-semibold text-sm">Kraken Lane</p>
                <p className="text-xs text-gray-500">Market data + execution via Kraken MCP</p>
              </div>
              <Badge label="live" variant="live" />
            </div>
            <p className="text-xs text-gray-600">Real-time OHLCV, EMA signals, paper + live Kraken orders</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-900 flex items-center justify-center text-purple-400 text-sm font-bold">⛓</div>
              <div>
                <p className="font-semibold text-sm">On-chain Lane</p>
                <p className="text-xs text-gray-500">Safe (EIP-1271) + Risk Router (EIP-712)</p>
              </div>
              <Badge label="pending" variant="pending" />
            </div>
            <p className="text-xs text-gray-600">Contracts deployed on Base Sepolia. Going live next.</p>
          </div>
        </div>

        {/* ── Tabs: Trades / Decisions ─────────────── */}
        <div>
          <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
            {(["trades", "decisions"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-gray-700 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab === "trades" ? `Trades (${trades.length})` : `Decisions (${decisions.length})`}
              </button>
            ))}
          </div>

          {activeTab === "trades" && (
            <Card title="Trade Log" subtitle="Only executed trades (paper / live / on-chain)">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-6 py-3 text-left">Time</th>
                    <th className="px-6 py-3 text-left">Pair</th>
                    <th className="px-6 py-3 text-left">Side</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right">Price</th>
                    <th className="px-6 py-3 text-right">P&L</th>
                    <th className="px-6 py-3 text-left">Lane</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-600 text-sm">
                        No trades yet. The agent will log trades here as it runs.
                      </td>
                    </tr>
                  ) : (
                    trades.map((t) => (
                      <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {timeAgo(t.created_at)}
                        </td>
                        <td className="px-6 py-3 font-mono font-medium text-white">{t.pair}</td>
                        <td className="px-6 py-3">
                          <Badge label={t.side} variant={t.side as "buy" | "sell"} />
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-300">
                          {fmt(t.amount, 4)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-300">
                          {t.price ? `$${fmt(t.price)}` : "—"}
                        </td>
                        <td className={`px-6 py-3 text-right font-mono text-sm ${
                          t.pnl === null ? "text-gray-600" : Number(t.pnl) >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {t.pnl === null ? "—" : `${Number(t.pnl) >= 0 ? "+" : ""}$${fmt(t.pnl)}`}
                          {t.pnl_percent !== null && (
                            <span className="text-xs ml-1 text-gray-500">
                              ({Number(t.pnl_percent) >= 0 ? "+" : ""}{fmt(t.pnl_percent)}%)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <Badge
                            label={t.lane}
                            variant={t.lane === "kraken" ? "live" : "pending"}
                          />
                        </td>
                        <td className="px-6 py-3">
                          <Badge
                            label={t.status}
                            variant={t.status as "paper" | "live" | "confirmed" | "pending" | "failed"}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {activeTab === "decisions" && (
            <Card title="Decision Log" subtitle="Raw agent decisions before execution">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-6 py-3 text-left">Time</th>
                    <th className="px-6 py-3 text-left">Pair</th>
                    <th className="px-6 py-3 text-left">Action</th>
                    <th className="px-6 py-3 text-left">Confidence</th>
                    <th className="px-6 py-3 text-left">Size</th>
                    <th className="px-6 py-3 text-left">SL / TP</th>
                    <th className="px-6 py-3 text-left">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-600 text-sm">
                        No decisions yet.
                      </td>
                    </tr>
                  ) : (
                    decisions.map((d) => (
                      <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {timeAgo(d.created_at)}
                        </td>
                        <td className="px-6 py-3 font-mono font-medium text-white">{d.pair}</td>
                        <td className="px-6 py-3">
                          <Badge
                            label={d.action}
                            variant={
                              d.action === "buy" ? "buy" :
                              d.action === "sell" ? "sell" :
                              d.action === "hold" ? "hold" : "default"
                            }
                          />
                        </td>
                        <td className="px-6 py-3">
                          <ConfBar value={d.confidence} />
                        </td>
                        <td className="px-6 py-3 text-gray-400 text-xs">
                          {d.amount_pct !== null ? `${d.amount_pct}%` : "—"}
                        </td>
                        <td className="px-6 py-3 text-xs text-gray-500">
                          {d.stop_loss_pct ? <span className="text-red-400">SL {d.stop_loss_pct}%</span> : null}
                          {d.stop_loss_pct && d.take_profit_pct ? " / " : null}
                          {d.take_profit_pct ? <span className="text-emerald-400">TP {d.take_profit_pct}%</span> : null}
                          {!d.stop_loss_pct && !d.take_profit_pct ? "—" : null}
                        </td>
                        <td className="px-6 py-3 text-xs text-gray-400 max-w-xs truncate" title={d.reasoning ?? ""}>
                          {d.reasoning ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* ── Footer ──────────────────────────────── */}
        <footer className="text-center text-xs text-gray-700 pt-4 pb-8">
          clenjex dashboard · auto-refreshes every 8s · Base Sepolia testnet
        </footer>
      </div>
    </main>
  );
}
