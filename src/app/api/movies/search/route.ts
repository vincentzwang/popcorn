import { NextResponse } from "next/server";
import { searchMovies } from "@/lib/tmdb";
import getDb from "@/lib/db";

interface LocalMovie {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: number | null;
  overview: string | null;
}

function searchLocal(q: string): LocalMovie[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT tmdb_id, title, poster_path, backdrop_path, release_year, overview
       FROM movies
       WHERE title LIKE ?
       ORDER BY release_year DESC
       LIMIT 12`
    )
    .all(`%${q}%`) as LocalMovie[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  // Try TMDB first; fall back to local DB
  const tmdbResults = await searchMovies(q);
  if (tmdbResults.length > 0) {
    return NextResponse.json(
      tmdbResults.slice(0, 12).map((m) => ({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        release_date: m.release_date,
        overview: m.overview,
      }))
    );
  }

  // Local fallback — shape to match TMDB format the UI expects
  const local = searchLocal(q);
  return NextResponse.json(
    local.map((m) => ({
      id: m.tmdb_id,
      title: m.title,
      poster_path: m.poster_path,
      release_date: m.release_year ? `${m.release_year}-01-01` : "",
      overview: m.overview ?? "",
    }))
  );
}
