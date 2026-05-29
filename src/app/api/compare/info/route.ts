import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids")?.split(",").map(Number).filter(Boolean) ?? [];

  if (ids.length === 0) return NextResponse.json([]);

  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT um.id, um.tier, um.score, um.review, m.title, m.poster_path, m.release_year,
              pu.username as watched_with_username
       FROM user_movies um
       JOIN movies m ON m.id = um.movie_id
       LEFT JOIN watched_with ww ON ww.user_movie_id = um.id
       LEFT JOIN users pu ON pu.id = ww.partner_id
       WHERE um.id IN (${placeholders})`
    )
    .all(...ids);

  return NextResponse.json(rows);
}
