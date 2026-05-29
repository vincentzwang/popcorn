import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const myId = session?.user ? Number((session.user as { id: string }).id) : null;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const db = getDb();

  const users = db
    .prepare(`
      SELECT
        u.id, u.username, u.created_at,
        COUNT(um.id) as movie_count,
        COUNT(CASE WHEN um.tier='liked' THEN 1 END) as liked_count
      FROM users u
      LEFT JOIN user_movies um ON um.user_id = u.id
      ${q ? "WHERE u.username LIKE ?" : ""}
      GROUP BY u.id
      ORDER BY movie_count DESC
      LIMIT 40
    `)
    .all(...(q ? [`%${q}%`] : [])) as Array<{
      id: number; username: string; created_at: string;
      movie_count: number; liked_count: number;
    }>;

  // Attach follow status for the current user
  const result = users.map((u) => {
    const isFollowing = myId
      ? Boolean(db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?").get(myId, u.id))
      : false;
    const followerCount = (db.prepare("SELECT COUNT(*) as n FROM follows WHERE following_id = ?").get(u.id) as { n: number }).n;
    return { ...u, isFollowing, followerCount };
  });

  return NextResponse.json(result);
}
