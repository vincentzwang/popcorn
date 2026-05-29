"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import { scoreColor } from "@/lib/scoring";

interface Movie {
  tmdb_id: number; title: string; poster_path: string | null;
  release_year: number | null; director: string | null;
  genres: string | null; rating_count: number; avg_score: number | null;
}

interface Friend { username: string; movie_count: number; }

function TonightInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [friend, setFriend] = useState(params.get("friend") ?? "");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [sharedGenres, setSharedGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    // Load people you follow as quick-pick options
    fetch("/api/users").then(r => r.json()).then((users: Friend[]) => setFriends(users.slice(0, 12)));
    // Auto-load if friend param present
    if (params.get("friend")) {
      handleSearch(params.get("friend")!);
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSearch(friendName?: string) {
    const target = friendName ?? friend;
    if (!target.trim()) return;
    setLoading(true);
    setSearched(true);
    const d = await fetch(`/api/tonight?friend=${encodeURIComponent(target)}`).then(r => r.json());
    setSuggestions(d.suggestions ?? []);
    setSharedGenres(d.sharedGenres ?? []);
    setLoading(false);
  }

  const myUsername = (session?.user as { username?: string })?.username;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">🎬 What should we watch tonight?</h1>
        <p className="mt-1 text-sm text-white/40">
          Pick a friend — we&apos;ll find movies you&apos;d both enjoy based on your shared taste.
        </p>
      </div>

      {/* Friend picker */}
      <div className="depth-card rounded-2xl p-5 space-y-4">
        <div className="flex gap-2">
          <input
            value={friend}
            onChange={e => setFriend(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Enter a username…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-500/40"
          />
          <button onClick={() => handleSearch()}
            disabled={!friend.trim() || loading}
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40">
            {loading ? "…" : "Find movies"}
          </button>
        </div>

        {/* Quick-pick from follows */}
        {friends.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-white/30">Quick pick</p>
            <div className="flex flex-wrap gap-2">
              {friends
                .filter(f => f.username !== myUsername)
                .slice(0, 8)
                .map(f => (
                  <button key={f.username}
                    onClick={() => { setFriend(f.username); handleSearch(f.username); }}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      friend === f.username
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                    }`}>
                    {f.username}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {searched && !loading && (
        <>
          {sharedGenres.length > 0 && (
            <p className="text-sm text-white/50">
              Based on your shared love of{" "}
              <span className="text-amber-400">{sharedGenres.slice(0, 3).join(", ")}</span>
            </p>
          )}

          {suggestions.length === 0 ? (
            <div className="depth-card rounded-2xl py-12 text-center">
              <p className="text-3xl mb-2">🤷</p>
              <p className="text-sm text-white/40">
                Couldn&apos;t find matching suggestions. Try rating more movies!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
              {suggestions.map(m => (
                <div key={m.tmdb_id} className="group space-y-2">
                  <Link href={`/movies/${m.tmdb_id}`} className="block">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/5 transition group-hover:ring-amber-500/40 group-hover:scale-[1.03]">
                      <SafeImage src={posterUrl(m.poster_path, "w342")} alt={m.title} fill className="object-cover" sizes="200px" />
                      {m.avg_score !== null && m.rating_count > 0 && (
                        <div className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm">
                          <span className={scoreColor(m.avg_score)}>{m.avg_score.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="px-0.5 space-y-0.5">
                    <p className="truncate text-xs font-medium text-white/80">{m.title}</p>
                    <p className="text-[11px] text-white/30">{m.release_year}</p>
                    {m.genres && (
                      <p className="truncate text-[10px] text-white/20">
                        {m.genres.split(",").slice(0, 2).join(", ")}
                      </p>
                    )}
                  </div>
                  <Link href={`/search?tmdbId=${m.tmdb_id}`}
                    className="block w-full rounded-lg border border-amber-500/20 bg-amber-500/10 py-1 text-center text-[11px] font-medium text-amber-400 transition hover:bg-amber-500/20">
                    Rate it →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TonightPage() {
  return <Suspense><TonightInner /></Suspense>;
}
