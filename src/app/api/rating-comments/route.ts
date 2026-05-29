import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";
import { createNotification } from "@/lib/notify";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const umId = Number(searchParams.get("umId"));
  if (!umId) return NextResponse.json([]);
  const db = getDb();
  const rows = db
    .prepare(`SELECT rc.id, rc.body, rc.created_at, u.username, u.id as user_id
              FROM rating_comments rc JOIN users u ON u.id = rc.user_id
              WHERE rc.user_movie_id = ? ORDER BY rc.created_at ASC`)
    .all(umId);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const commenterUsername = (session.user as { username?: string }).username ?? "";
  const { umId, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Empty" }, { status: 400 });
  const db = getDb();
  const um = db.prepare(`SELECT um.user_id, m.title, m.tmdb_id
    FROM user_movies um JOIN movies m ON m.id = um.movie_id WHERE um.id = ?`).get(umId) as
    { user_id: number; title: string; tmdb_id: number } | undefined;
  if (!um) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = db.prepare("INSERT INTO rating_comments (user_id, user_movie_id, body) VALUES (?,?,?)").run(userId, umId, body.trim());
  createNotification(db, {
    userId: um.user_id, actorId: userId, actorUsername: commenterUsername,
    type: "comment",
    message: `${commenterUsername} commented on your rating of ${um.title}`,
    link: `/movies/${um.tmdb_id}`,
  });
  const row = db
    .prepare(`SELECT rc.id, rc.body, rc.created_at, u.username, u.id as user_id
              FROM rating_comments rc JOIN users u ON u.id = rc.user_id WHERE rc.id = ?`)
    .get(result.lastInsertRowid);
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const { commentId } = await req.json();
  const db = getDb();
  db.prepare("DELETE FROM rating_comments WHERE id = ? AND user_id = ?").run(commentId, userId);
  return NextResponse.json({ ok: true });
}
