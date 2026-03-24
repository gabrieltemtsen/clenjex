import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 500);
  const pool = getPool();
  const { rows } = await pool.query(
    `select id, pair, action, confidence, amount_pct, stop_loss_pct, take_profit_pct, reasoning, created_at
     from decisions
     order by created_at desc
     limit $1`,
    [limit]
  );
  return NextResponse.json({ rows });
}
