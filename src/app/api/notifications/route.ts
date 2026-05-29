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
    SELECT id, actor_username, type, message, link, read, created_at
    FROM notifications WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(userId);

  const unread = (db.prepare("SELECT COUNT(*) as n FROM notifications WHERE user_id = ? AND read = 0").get(userId) as { n: number }).n;

  return NextResponse.json({ items, unread });
}

// PATCH — mark all (or specific ids) as read
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const db = getDb();
  const body = await req.json().catch(() => ({})) as { ids?: number[] };

  if (body.ids?.length) {
    const ph = body.ids.map(() => "?").join(",");
    db.prepare(`UPDATE notifications SET read=1 WHERE user_id=? AND id IN (${ph})`).run(userId, ...body.ids);
  } else {
    db.prepare("UPDATE notifications SET read=1 WHERE user_id=?").run(userId);
  }
  return NextResponse.json({ ok: true });
}
