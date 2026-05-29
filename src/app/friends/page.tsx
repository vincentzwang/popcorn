"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FeedItem, { type FeedEntry } from "@/components/FeedItem";

interface UserRow {
  id: number; username: string; movie_count: number;
  liked_count: number; followerCount: number; isFollowing: boolean;
}


export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"feed" | "discover">("feed");
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const myUsername = (session?.user as { username?: string })?.username;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/friends/feed")
      .then((r) => r.json())
      .then((d) => { setFeed(d.items ?? d); setLoadingFeed(false); });
    fetch("/api/users")
      .then((r) => r.json())
      .then((d: UserRow[]) => {
        setUsers(d);
        const m: Record<string, boolean> = {};
        d.forEach((u) => { m[u.username] = u.isFollowing; });
        setFollowing(m);
        setLoadingUsers(false);
      });
  }, [status]);

  const doSearch = useCallback((q: string) => {
    setSearch(q);
    setLoadingUsers(true);
    fetch(`/api/users?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: UserRow[]) => {
        setUsers(d);
        const m: Record<string, boolean> = {};
        d.forEach((u) => { m[u.username] = u.isFollowing; });
        setFollowing(m);
        setLoadingUsers(false);
      });
  }, []);

  async function toggleFollow(username: string) {
    const action = following[username] ? "unfollow" : "follow";
    setFollowing((prev) => ({ ...prev, [username]: !prev[username] }));
    await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, action }),
    });
    if (action === "follow") {
      // Reload feed
      fetch("/api/friends/feed").then((r) => r.json()).then((d) => setFeed(d.items ?? d));
    }
  }

  if (status === "loading") return null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Friends</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
        {(["feed", "discover"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {t === "feed" ? "👥 Following Feed" : "🔍 Discover People"}
          </button>
        ))}
      </div>

      {/* ── FOLLOWING FEED ── */}
      {tab === "feed" && (
        <>
          {loadingFeed ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />)}
            </div>
          ) : feed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-4xl mb-3">👥</p>
              <p className="font-medium text-white/50">The reel is empty</p>
              <p className="mt-1 text-sm text-white/30">Follow some people to see their ratings here.</p>
              <button
                onClick={() => setTab("discover")}
                className="mt-4 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400"
              >
                Find people to follow
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {feed.map((entry) => <FeedItem key={entry.id} entry={entry} />)}
            </div>
          )}
        </>
      )}

      {/* ── DISCOVER PEOPLE ── */}
      {tab === "discover" && (
        <>
          <div className="mb-4">
            <input
              value={search}
              onChange={(e) => doSearch(e.target.value)}
              placeholder="Search by username…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-amber-500/40"
            />
          </div>
          {loadingUsers ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {users.filter((u) => u.username !== myUsername).map((user) => (
                <div key={user.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:border-white/10">
                  <Link href={`/profile/${user.username}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold uppercase text-amber-400">
                      {user.username[0]}
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${user.username}`}>
                      <p className="font-semibold text-white hover:text-amber-400">{user.username}</p>
                    </Link>
                    <p className="text-xs text-white/30">
                      {user.movie_count} movies · {user.followerCount} followers
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFollow(user.username)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      following[user.username]
                        ? "bg-white/10 text-white/60 hover:bg-red-500/20 hover:text-red-400"
                        : "bg-amber-500 text-black hover:bg-amber-400"
                    }`}
                  >
                    {following[user.username] ? "Following" : "Follow"}
                  </button>
                </div>
              ))}
              {users.filter((u) => u.username !== myUsername).length === 0 && (
                <p className="py-10 text-center text-sm text-white/30">No users found.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
