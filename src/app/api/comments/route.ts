import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = Number(searchParams.get("tmdbId"));
  if (!tmdbId) return NextResponse.json([]);
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.id, c.body, c.created_at, u.username, u.id as user_id
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.movie_id = (SELECT id FROM movies WHERE tmdb_id = ?)
    ORDER BY c.created_at ASC
  `).all(tmdbId);
  return NextResponse.json(comments);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const { tmdbId, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Empty comment" }, { status: 400 });
  const db = getDb();
  const movie = db.prepare("SELECT id FROM movies WHERE tmdb_id = ?").get(tmdbId) as { id: number } | undefined;
  if (!movie) return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  const result = db.prepare("INSERT INTO comments (user_id, movie_id, body) VALUES (?,?,?)").run(userId, movie.id, body.trim());
  const comment = db.prepare("SELECT c.id, c.body, c.created_at, u.username, u.id as user_id FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?").get(result.lastInsertRowid);
  return NextResponse.json(comment);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const { commentId } = await req.json();
  const db = getDb();
  db.prepare("DELETE FROM comments WHERE id = ? AND user_id = ?").run(commentId, userId);
  return NextResponse.json({ ok: true });
}
