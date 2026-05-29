import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const genre    = searchParams.get("genre") ?? "";
  const director = searchParams.get("director") ?? "";

  const db = getDb();

  if (genre) {
    const movies = db.prepare(`
      SELECT m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.genres, m.streaming,
             COUNT(um.id) as rating_count, AVG(um.score) as avg_score
      FROM movies m
      LEFT JOIN user_movies um ON um.movie_id = m.id
      WHERE m.genres LIKE ?
      GROUP BY m.id
      ORDER BY avg_score DESC, rating_count DESC, m.release_year DESC
      LIMIT 60
    `).all(`%${genre}%`);
    return NextResponse.json(movies);
  }

  if (director) {
    const movies = db.prepare(`
      SELECT m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.genres, m.streaming,
             COUNT(um.id) as rating_count, AVG(um.score) as avg_score
      FROM movies m
      LEFT JOIN user_movies um ON um.movie_id = m.id
      WHERE LOWER(m.director) = LOWER(?)
      GROUP BY m.id
      ORDER BY m.release_year DESC
      LIMIT 60
    `).all(director);
    return NextResponse.json(movies);
  }

  // List all genres with counts
  const rows = db.prepare("SELECT genres FROM movies WHERE genres IS NOT NULL").all() as { genres: string }[];
  const counts: Record<string, number> = {};
  for (const { genres } of rows) {
    for (const g of genres.split(",").map(g => g.trim())) {
      if (g) counts[g] = (counts[g] ?? 0) + 1;
    }
  }
  const list = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json(list);
}
