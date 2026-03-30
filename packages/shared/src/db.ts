import pg from "pg";

export type Db = pg.Pool;

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 5 });
}

export async function ensureSchema(pool: pg.Pool) {
  // Minimal schema (no migrations framework) — idempotent.
  await pool.query(`
    create table if not exists pair_state (
      pair text primary key,
      price numeric,
      signal_side text,
      signal_confidence int,
      signal_reasoning text,
      last_run_at timestamptz,
      last_error text,
      updated_at timestamptz not null default now()
    );

    create table if not exists decisions (
      id bigserial primary key,
      pair text not null,
      action text not null,
      confidence int,
      amount_pct int,
      stop_loss_pct numeric,
      take_profit_pct numeric,
      reasoning text,
      raw jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists trades (
      id bigserial primary key,
      pair text not null,
      side text not null,
      amount numeric,
      price numeric,
      lane text not null,
      status text not null,
      order_id text,
      intent_hash text,
      tx_hash text,
      pnl numeric,
      pnl_percent numeric,
      created_at timestamptz not null default now()
    );

    -- Backfill/upgrade for existing DBs
    alter table trades add column if not exists order_id text;

    create table if not exists artifacts (
      id bigserial primary key,
      kind text not null,
      pair text,
      lane text,
      trade_id bigint,
      payload jsonb not null,
      created_at timestamptz not null default now()
    );

    create index if not exists idx_trades_created_at on trades(created_at desc);
    create index if not exists idx_decisions_created_at on decisions(created_at desc);
    create index if not exists idx_artifacts_created_at on artifacts(created_at desc);
  `);
}

export async function upsertPairState(
  pool: pg.Pool,
  params: {
    pair: string;
    price?: number;
    signal_side?: string;
    signal_confidence?: number;
    signal_reasoning?: string;
    last_run_at?: Date;
    last_error?: string | null;
  }
) {
  const {
    pair,
    price,
    signal_side,
    signal_confidence,
    signal_reasoning,
    last_run_at,
    last_error,
  } = params;

  await pool.query(
    `
    insert into pair_state (
      pair, price, signal_side, signal_confidence, signal_reasoning, last_run_at, last_error, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7, now())
    on conflict (pair) do update set
      price = excluded.price,
      signal_side = excluded.signal_side,
      signal_confidence = excluded.signal_confidence,
      signal_reasoning = excluded.signal_reasoning,
      last_run_at = excluded.last_run_at,
      last_error = excluded.last_error,
      updated_at = now();
    `,
    [
      pair,
      price ?? null,
      signal_side ?? null,
      signal_confidence ?? null,
      signal_reasoning ?? null,
      last_run_at ?? new Date(),
      last_error ?? null,
    ]
  );
}

export async function insertDecision(pool: pg.Pool, d: {
  pair: string;
  action: string;
  confidence?: number;
  amount_pct?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  reasoning?: string;
  raw?: unknown;
}) {
  await pool.query(
    `
    insert into decisions (pair, action, confidence, amount_pct, stop_loss_pct, take_profit_pct, reasoning, raw)
    values ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      d.pair,
      d.action,
      d.confidence ?? null,
      d.amount_pct ?? null,
      d.stop_loss_pct ?? null,
      d.take_profit_pct ?? null,
      d.reasoning ?? null,
      d.raw ?? null,
    ]
  );
}

export async function insertTrade(pool: pg.Pool, t: {
  pair: string;
  side: string;
  amount?: string | number;
  price?: string | number;
  lane: string;
  status: string;
  order_id?: string;
  intent_hash?: string;
  tx_hash?: string;
}): Promise<{ id: number }> {
  const { rows } = await pool.query(
    `
    insert into trades (pair, side, amount, price, lane, status, order_id, intent_hash, tx_hash)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    returning id
    `,
    [
      t.pair,
      t.side,
      t.amount ?? null,
      t.price ?? null,
      t.lane,
      t.status,
      t.order_id ?? null,
      t.intent_hash ?? null,
      t.tx_hash ?? null,
    ]
  );
  return { id: Number(rows[0].id) };
}

export async function insertArtifact(pool: pg.Pool, a: {
  kind: string;
  pair?: string;
  lane?: string;
  trade_id?: number;
  payload: unknown;
}): Promise<{ id: number }> {
  const { rows } = await pool.query(
    `
    insert into artifacts (kind, pair, lane, trade_id, payload)
    values ($1,$2,$3,$4,$5)
    returning id
    `,
    [a.kind, a.pair ?? null, a.lane ?? null, a.trade_id ?? null, a.payload]
  );
  return { id: Number(rows[0].id) };
}
