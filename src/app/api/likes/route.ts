import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";
import { createNotification } from "@/lib/notify";

// POST — toggle like on a rating
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const likerId = Number((session.user as { id: string }).id);
  const likerUsername = (session.user as { username?: string }).username ?? "";
  const { umId } = await req.json();
  const db = getDb();

  const existing = db.prepare("SELECT id FROM rating_likes WHERE liker_id = ? AND user_movie_id = ?").get(likerId, umId);
  if (existing) {
    db.prepare("DELETE FROM rating_likes WHERE liker_id = ? AND user_movie_id = ?").run(likerId, umId);
  } else {
    db.prepare("INSERT OR IGNORE INTO rating_likes (liker_id, user_movie_id) VALUES (?,?)").run(likerId, umId);
    // Notify rating owner
    const um = db.prepare(`SELECT um.user_id, m.title, m.tmdb_id
      FROM user_movies um JOIN movies m ON m.id = um.movie_id WHERE um.id = ?`).get(umId) as
      { user_id: number; title: string; tmdb_id: number } | undefined;
    if (um) {
      createNotification(db, {
        userId: um.user_id, actorId: likerId, actorUsername: likerUsername,
        type: "like",
        message: `${likerUsername} liked your rating of ${um.title}`,
        link: `/movies/${um.tmdb_id}`,
      });
    }
  }
  const count = (db.prepare("SELECT COUNT(*) as n FROM rating_likes WHERE user_movie_id = ?").get(umId) as { n: number }).n;
  return NextResponse.json({ liked: !existing, count });
}

// GET — fetch liked status for a set of um_ids (comma-separated)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({});
  const likerId = Number((session.user as { id: string }).id);
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map(Number).filter(Boolean);
  if (!ids.length) return NextResponse.json({});
  const db = getDb();
  const rows = db
    .prepare(`SELECT user_movie_id FROM rating_likes WHERE liker_id = ? AND user_movie_id IN (${ids.map(() => "?").join(",")})`)
    .all(likerId, ...ids) as { user_movie_id: number }[];
  const liked = Object.fromEntries(rows.map(r => [r.user_movie_id, true]));
  return NextResponse.json(liked);
}
