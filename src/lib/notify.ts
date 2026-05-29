import type Database from "better-sqlite3";

type NotifType = "follow" | "like" | "comment";

export function createNotification(
  db: Database.Database,
  opts: {
    userId: number;        // recipient
    actorId: number;       // who did the action
    actorUsername: string;
    type: NotifType;
    message: string;
    link?: string;
  }
) {
  // Don't notify yourself
  if (opts.userId === opts.actorId) return;
  // Dedupe: avoid duplicate notifications of same type from same actor in last hour
  const recent = db.prepare(`
    SELECT id FROM notifications
    WHERE user_id=? AND actor_id=? AND type=? AND created_at > datetime('now','-1 hour')
  `).get(opts.userId, opts.actorId, opts.type);
  if (recent) return;

  db.prepare(`
    INSERT INTO notifications (user_id, actor_id, actor_username, type, message, link)
    VALUES (?,?,?,?,?,?)
  `).run(opts.userId, opts.actorId, opts.actorUsername, opts.type, opts.message, opts.link ?? null);
}
