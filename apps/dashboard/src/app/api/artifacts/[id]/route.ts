import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const artifactId = Number(id);
  if (!Number.isFinite(artifactId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `select id, kind, pair, lane, trade_id, payload, created_at
     from artifacts
     where id = $1
     limit 1`,
    [artifactId]
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Return the payload directly (plus metadata) so it can be used as an ERC-8004 evidence URI target.
  return NextResponse.json(rows[0]);
}
