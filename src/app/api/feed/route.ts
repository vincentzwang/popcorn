import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

const PAGE = 20;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const myId = session?.user ? Number((session.user as { id: string }).id) : null;
  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before"); // cursor: last seen um.id
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      um.id, um.tier, um.score, um.review, um.created_at,
      m.tmdb_id, m.title, m.poster_path, m.release_year,
      u.username,
      COUNT(DISTINCT rl.id) as like_count,
      COUNT(DISTINCT rc.id) as comment_count,
      MAX(CASE WHEN rl.liker_id = ? THEN 1 ELSE 0 END) as liked_by_me
    FROM user_movies um
    JOIN movies m ON m.id = um.movie_id
    JOIN users u ON u.id = um.user_id
    LEFT JOIN rating_likes rl ON rl.user_movie_id = um.id
    LEFT JOIN rating_comments rc ON rc.user_movie_id = um.id
    ${before ? "WHERE um.id < ?" : ""}
    GROUP BY um.id
    ORDER BY um.created_at DESC
    LIMIT ?
  `).all(...[myId ?? -1, ...(before ? [Number(before)] : []), PAGE + 1]);

  const hasMore = rows.length > PAGE;
  const items = rows.slice(0, PAGE);
  const nextCursor = hasMore ? (items[items.length - 1] as { id: number }).id : null;

  return NextResponse.json({ items, hasMore, nextCursor });
}
