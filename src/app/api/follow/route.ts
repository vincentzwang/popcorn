import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";
import { createNotification } from "@/lib/notify";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const followerId = Number((session.user as { id: string }).id);
  const followerUsername = (session.user as { username?: string }).username ?? "";
  const { username, action } = await req.json();

  const db = getDb();
  const target = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === followerId) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  if (action === "follow") {
    db.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?,?)").run(followerId, target.id);
    createNotification(db, {
      userId: target.id,
      actorId: followerId,
      actorUsername: followerUsername,
      type: "follow",
      message: `${followerUsername} started following you`,
      link: `/profile/${followerUsername}`,
    });
  } else {
    db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(followerId, target.id);
  }

  const followers = (db.prepare("SELECT COUNT(*) as n FROM follows WHERE following_id = ?").get(target.id) as { n: number }).n;
  return NextResponse.json({ ok: true, followers });
}
