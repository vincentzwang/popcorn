"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TimeAgo from "@/components/TimeAgo";

interface Notif {
  id: number;
  actor_username: string;
  type: "follow" | "like" | "comment";
  message: string;
  link: string | null;
  read: number;
  created_at: string;
}

const typeIcon: Record<string, string> = { follow: "👤", like: "❤️", comment: "💬" };


export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/signin"); return; }
    if (status !== "authenticated") return;

    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => { setNotifs(d.items ?? []); setLoading(false); });

    // Mark all as read
    fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
  }, [status, router]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-white/30">Loading…</div>;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-white">Notifications</h1>

      {notifs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/8 py-16 text-center">
          <p className="text-3xl mb-3">🔔</p>
          <p className="text-sm text-white/40">All quiet in the projection booth — follow people and start rating.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifs.map(n => {
            const row = (
              <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition
                ${n.read ? "border-white/5 bg-white/[0.02]" : "border-amber-500/20 bg-amber-500/[0.06]"}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm
                  ${n.read ? "bg-white/8" : "bg-amber-500/20"}`}>
                  {typeIcon[n.type]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/80">{n.message}</p>
                  <TimeAgo date={n.created_at} className="mt-0.5 text-xs text-white/30" />
                </div>
                {!n.read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link}>{row}</Link>
            ) : (
              <div key={n.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
