import { NextResponse } from "next/server";
import getDb from "@/lib/db";

interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  overview: string;
}

export async function GET() {
  const key = process.env.TMDB_API_KEY;
  if (!key || key === "your_tmdb_api_key_here") return NextResponse.json([]);

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/now_playing?api_key=${key}&language=en-US&page=1`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return NextResponse.json([]);

  const data = await res.json();
  const movies: TmdbMovie[] = (data.results ?? []).slice(0, 20);

  // Upsert into local DB so they can be rated
  const db = getDb();
  const upsert = db.prepare(`
    INSERT OR IGNORE INTO movies (tmdb_id, title, poster_path, backdrop_path, release_year, overview)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const m of movies) {
    const year = m.release_date ? parseInt(m.release_date.slice(0, 4)) : null;
    upsert.run(m.id, m.title, m.poster_path, m.backdrop_path, year, m.overview);
  }

  return NextResponse.json(
    movies.map((m) => ({
      tmdb_id: m.id,
      title: m.title,
      poster_path: m.poster_path,
      release_date: m.release_date,
      overview: m.overview,
    }))
  );
}
