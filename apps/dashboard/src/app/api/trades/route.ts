import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const pool = getPool();
  const { rows } = await pool.query(
    `select id, pair, side, amount, price, lane, status, intent_hash, tx_hash, pnl, pnl_percent, created_at
     from trades
     order by created_at desc
     limit $1`,
    [limit]
  );
  return NextResponse.json({ rows });
}
