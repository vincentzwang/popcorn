import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? Number((session.user as { id: string }).id) : null;
  const db = getDb();

  // Most-rated movies site-wide
  const topRated = db
    .prepare(`
      SELECT
        m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.overview,
        COUNT(um.id) as rating_count,
        AVG(um.score) as avg_score,
        SUM(CASE WHEN um.tier='liked' THEN 1 ELSE 0 END) as liked_count
      FROM movies m
      LEFT JOIN user_movies um ON um.movie_id = m.id
      GROUP BY m.id
      ORDER BY rating_count DESC, m.release_year DESC
      LIMIT 12
    `)
    .all() as Array<{
      tmdb_id: number; title: string; poster_path: string | null;
      release_year: number | null; director: string | null; overview: string | null;
      rating_count: number; avg_score: number | null; liked_count: number;
    }>;

  // Unrated by this user (or random if logged out) — for "Discover" section
  const unrated = userId
    ? (db
        .prepare(`
          SELECT m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.overview
          FROM movies m
          WHERE m.id NOT IN (
            SELECT um.movie_id FROM user_movies um WHERE um.user_id = ?
          )
          ORDER BY RANDOM()
          LIMIT 12
        `)
        .all(userId) as Array<{
          tmdb_id: number; title: string; poster_path: string | null;
          release_year: number | null; director: string | null; overview: string | null;
        }>)
    : (db
        .prepare(`
          SELECT tmdb_id, title, poster_path, release_year, director, overview
          FROM movies ORDER BY RANDOM() LIMIT 12
        `)
        .all() as Array<{
          tmdb_id: number; title: string; poster_path: string | null;
          release_year: number | null; director: string | null; overview: string | null;
        }>);

  return NextResponse.json({ topRated, unrated });
}
