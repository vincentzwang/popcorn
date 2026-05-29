"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import { tierColor, tierLabel, scoreColor } from "@/lib/scoring";
import type { Tier } from "@/lib/scoring";

interface MovieEntry {
  id: number;
  tier: Tier;
  position: number;
  score: number | null;
  review: string | null;
  created_at: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  director: string | null;
  watched_with_username: string | null;
}

interface ProfileData {
  user: { id: number; username: string };
  movies: MovieEntry[];
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: session } = useSession();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Tier | "all" | "watchlist">("all");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [compatibility, setCompatibility] = useState<number | null>(null);
  const [watchlist, setWatchlist] = useState<MovieEntry[]>([]);

  const sessionUsername = (session?.user as { username?: string })?.username;
  const isOwnProfile = sessionUsername === username;
  const isLoggedIn = Boolean(session);
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  useEffect(() => {
    fetch(`/api/user/${username}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [username]);

  // Load follow status for non-own profiles
  useEffect(() => {
    if (isOwnProfile || !session) return;
    fetch(`/api/users?q=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((users: Array<{ username: string; isFollowing: boolean; followerCount: number }>) => {
        const u = users.find((u) => u.username === username);
        if (u) { setIsFollowing(u.isFollowing); setFollowerCount(u.followerCount); }
      });
    // Load compatibility score for other users
    fetch(`/api/compatibility/${username}`)
      .then(r => r.json())
      .then(d => setCompatibility(d.score ?? null));
  }, [username, isOwnProfile, session]);

  // Load watchlist for own profile
  useEffect(() => {
    if (!isOwnProfile || !session) return;
    fetch("/api/watchlist").then(r => r.json()).then((items: MovieEntry[]) => setWatchlist(items));
  }, [isOwnProfile, session]);

  async function toggleFollow() {
    setFollowLoading(true);
    const action = isFollowing ? "unfollow" : "follow";
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, action }),
    });
    const d = await res.json();
    setIsFollowing(!isFollowing);
    setFollowerCount(d.followers ?? followerCount);
    setFollowLoading(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/30">Loading…</div>
    );
  }

  if (!data || !data.user) {
    // Own profile not found → stale JWT pointing to a deleted account
    if (isOwnProfile) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="text-4xl">🔑</div>
          <h2 className="text-xl font-bold text-white">Your session is out of date</h2>
          <p className="max-w-sm text-sm text-white/50">
            Your account no longer exists in the database. Sign out and create a new account to continue.
          </p>
          <button
            onClick={() => signOut({ callbackUrl: "/signup" })}
            className="rounded-full bg-amber-500 px-6 py-2.5 font-semibold text-black transition hover:bg-amber-400"
          >
            Sign out &amp; sign up again
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/30">
        User not found.
      </div>
    );
  }

  const tiers: Tier[] = ["liked", "fine", "disliked"];
  const grouped = tiers.reduce((acc, t) => {
    acc[t] = data.movies.filter((m) => m.tier === t).sort((a, b) => a.position - b.position);
    return acc;
  }, {} as Record<Tier, MovieEntry[]>);

  const filtered = activeFilter === "all" || activeFilter === "watchlist" ? data.movies : grouped[activeFilter as Tier];
  const sortedFiltered = [...filtered].sort((a, b) => {
    if (a.tier !== b.tier) return tiers.indexOf(a.tier) - tiers.indexOf(b.tier);
    return a.position - b.position;
  });

  const tierEmoji = { liked: "😍", fine: "😐", disliked: "👎" };

  return (
    <div>
      {/* Profile header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-2xl font-bold text-amber-400">
            {username[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{username}</h1>
            <p className="text-sm text-white/40">
              {data.movies.length} movie{data.movies.length !== 1 ? "s" : ""} rated
              {followerCount > 0 && ` · ${followerCount} follower${followerCount !== 1 ? "s" : ""}`}
            </p>
            {!isOwnProfile && compatibility !== null && (
              <Link href={`/compare/${username}`} className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20">
                🎬 {compatibility}% compatible
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <button onClick={copyLink}
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/40 transition hover:border-white/20 hover:text-white">
            {copied ? "✓ Copied!" : "🔗"}
          </button>
          <Link
            href={`/stats?user=${username}`}
            className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-white/50 transition hover:border-white/20 hover:text-white"
          >
            📊 Stats
          </Link>
          {isOwnProfile ? (
            <Link
              href="/search"
              className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              + Rate
            </Link>
          ) : isLoggedIn ? (
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                isFollowing
                  ? "border border-white/10 text-white/60 hover:border-red-500/30 hover:text-red-400"
                  : "bg-amber-500 text-black hover:bg-amber-400"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Stats row */}
      {data.movies.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {tiers.map((t) => (
            <div
              key={t}
              className="rounded-xl border border-white/5 bg-white/5 p-4 text-center"
            >
              <div className="text-2xl">{tierEmoji[t]}</div>
              <div className={`text-lg font-bold ${tierColor(t)}`}>{grouped[t].length}</div>
              <div className="text-xs text-white/40">{tierLabel(t)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {(data.movies.length > 0 || watchlist.length > 0) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(["all", ...tiers] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeFilter === f ? "bg-amber-500 text-black" : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {f === "all" ? "All" : `${tierEmoji[f]} ${tierLabel(f)}`}
            </button>
          ))}
          {isOwnProfile && (
            <button
              onClick={() => setActiveFilter("watchlist")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeFilter === "watchlist" ? "bg-amber-500 text-black" : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              🔖 Watchlist {watchlist.length > 0 && `(${watchlist.length})`}
            </button>
          )}
        </div>
      )}

      {/* Watchlist view */}
      {activeFilter === "watchlist" && (
        <div>
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <div className="text-4xl">🔖</div>
              <p className="mt-3 text-white/50">Your watchlist awaits its first feature</p>
              <Link href="/search" className="mt-4 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400">Browse movies</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {watchlist.map((movie, idx) => (
                <div key={movie.tmdb_id} className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:bg-white/8">
                  <span className="w-6 text-center text-sm font-bold text-white/20">{idx + 1}</span>
                  <Link href={`/movies/${movie.tmdb_id}`}>
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-white/10">
                      <SafeImage src={posterUrl(movie.poster_path, "w92")} alt={movie.title} fill className="object-cover" />
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/movies/${movie.tmdb_id}`}><p className="truncate font-semibold text-white hover:text-amber-400">{movie.title}</p></Link>
                    <p className="text-xs text-white/40">{movie.release_year}</p>
                  </div>
                  <Link href={`/search?tmdbId=${movie.tmdb_id}`} className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/25">Rate it</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Movie list */}
      {activeFilter !== "watchlist" && data.movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <div className="text-4xl">🎬</div>
          <p className="mt-3 text-lg font-medium text-white/60">No films in the log yet</p>
          <Link
            href="/search"
            className="mt-4 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            Rate your first movie
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedFiltered.map((movie, idx) => (
            <div
              key={movie.id}
              className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:border-white/10 hover:bg-white/8"
            >
              <span className="w-6 text-center text-sm font-bold text-white/20">
                {idx + 1}
              </span>
              <Link href={`/movies/${movie.tmdb_id}`}>
                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-white/10">
                  <SafeImage
                    src={posterUrl(movie.poster_path, "w92")}
                    alt={movie.title}
                    fill
                    className="object-cover"
                  />
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/movies/${movie.tmdb_id}`}>
                  <p className="truncate font-semibold text-white hover:text-amber-400">
                    {movie.title}
                  </p>
                </Link>
                <p className="text-xs text-white/40">
                  {movie.release_year}
                  {movie.director ? ` · ${movie.director}` : ""}
                </p>
                {movie.watched_with_username && (
                  <p className="mt-0.5 text-[11px] text-amber-400/60">
                    🎟️ with{" "}
                    <Link href={`/profile/${movie.watched_with_username}`} className="hover:text-amber-400 transition">
                      @{movie.watched_with_username}
                    </Link>
                  </p>
                )}
                {movie.review && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-white/50 italic">
                    &ldquo;{movie.review}&rdquo;
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <div className="text-right">
                  {movie.score !== null && (
                    <div className={`text-lg font-bold ${scoreColor(movie.score)}`}>
                      {movie.score.toFixed(1)}
                    </div>
                  )}
                  <div className={`text-xs ${tierColor(movie.tier as Tier)}`}>
                    {tierEmoji[movie.tier as keyof typeof tierEmoji]} {tierLabel(movie.tier as Tier)}
                  </div>
                </div>
                {isOwnProfile && (
                  <Link
                    href={`/edit/${movie.id}?tmdbId=${movie.tmdb_id}`}
                    className="ml-1 rounded-lg p-1.5 text-white/20 transition hover:bg-white/5 hover:text-white/60"
                    title="Edit rating"
                  >
                    ✏️
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {activeFilter !== "watchlist" && !isOwnProfile && data.movies.length > 0 && (
        <div className="mt-6 text-center">
          <Link href={`/compare/${username}`} className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-5 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/20">
            🎬 Compare taste with {username}
          </Link>
        </div>
      )}
    </div>
  );
}
