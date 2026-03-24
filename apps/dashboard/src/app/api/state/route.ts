import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db";

export async function GET() {
  const pool = getPool();
  const { rows } = await pool.query(
    `select pair, price, signal_side, signal_confidence, signal_reasoning, last_run_at, last_error, updated_at
     from pair_state
     order by pair asc`
  );
  return NextResponse.json({ rows });
}
