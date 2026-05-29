import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const db = getDb();
  const items = db.prepare(`
    SELECT m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.genres, m.streaming, w.created_at
    FROM watchlist w JOIN movies m ON m.id = w.movie_id
    WHERE w.user_id = ? ORDER BY w.created_at DESC
  `).all(userId);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const { tmdbId } = await req.json();
  const db = getDb();

  const movie = db.prepare("SELECT id FROM movies WHERE tmdb_id = ?").get(tmdbId) as { id: number } | undefined;
  if (!movie) return NextResponse.json({ error: "Movie not found" }, { status: 404 });

  const existing = db.prepare("SELECT id FROM watchlist WHERE user_id = ? AND movie_id = ?").get(userId, movie.id);
  if (existing) {
    db.prepare("DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?").run(userId, movie.id);
    return NextResponse.json({ saved: false });
  }
  db.prepare("INSERT INTO watchlist (user_id, movie_id) VALUES (?,?)").run(userId, movie.id);
  return NextResponse.json({ saved: true });
}
