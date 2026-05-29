import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = getDb();

  const user = db
    .prepare("SELECT id, username FROM users WHERE username = ?")
    .get(username) as { id: number; username: string } | undefined;

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const movies = db
    .prepare(`
      SELECT
        um.id, um.tier, um.position, um.score, um.review, um.created_at,
        m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.overview,
        pu.username as watched_with_username
      FROM user_movies um
      JOIN movies m ON m.id = um.movie_id
      LEFT JOIN watched_with ww ON ww.user_movie_id = um.id
      LEFT JOIN users pu ON pu.id = ww.partner_id
      WHERE um.user_id = ?
      ORDER BY um.tier, um.position ASC
    `)
    .all(user.id);

  return NextResponse.json({ user, movies });
}
