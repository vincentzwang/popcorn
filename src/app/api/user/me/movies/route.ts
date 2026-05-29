import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as { id: string }).id);
  const db = getDb();

  const movies = db
    .prepare(`
      SELECT
        um.id, um.tier, um.position, um.score, um.review,
        m.tmdb_id, m.title, m.poster_path, m.release_year
      FROM user_movies um
      JOIN movies m ON m.id = um.movie_id
      WHERE um.user_id = ?
      ORDER BY um.tier, um.position ASC
    `)
    .all(userId);

  return NextResponse.json(movies);
}
