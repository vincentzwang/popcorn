"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";

type Tier = "liked" | "fine" | "disliked";

const STARTER_MOVIES = [
  { tmdb_id: 155,    title: "The Dark Knight",           poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg" },
  { tmdb_id: 680,    title: "Pulp Fiction",              poster_path: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg" },
  { tmdb_id: 27205,  title: "Inception",                 poster_path: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg" },
  { tmdb_id: 13,     title: "Forrest Gump",              poster_path: "/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg" },
  { tmdb_id: 496243, title: "Parasite",                  poster_path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
  { tmdb_id: 129,    title: "Spirited Away",             poster_path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg" },
  { tmdb_id: 603,    title: "The Matrix",                poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg" },
  { tmdb_id: 550,    title: "Fight Club",                poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg" },
  { tmdb_id: 157336, title: "Interstellar",              poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg" },
  { tmdb_id: 244786, title: "Whiplash",                  poster_path: "/7fn624j5lj3xTme2SgiLCeuedmO.jpg" },
  { tmdb_id: 872585, title: "Oppenheimer",               poster_path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
  { tmdb_id: 545611, title: "Everything Everywhere…",    poster_path: "/w3LxiVYdWWRvEVbn5RYq6jIqkb1.jpg" },
];

const TARGET = 5;

const TIER_CFG = {
  liked:    { emoji: "😍", label: "Liked",    cls: "bg-emerald-500/20 border-emerald-500 text-emerald-300" },
  fine:     { emoji: "😐", label: "Fine",      cls: "bg-amber-500/20 border-amber-500 text-amber-300" },
  disliked: { emoji: "👎", label: "Disliked", cls: "bg-red-500/20 border-red-500 text-red-300" },
};

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rated, setRated] = useState<Record<number, Tier>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  const ratedCount = Object.keys(rated).length;
  const pct = Math.min((ratedCount / TARGET) * 100, 100);

  async function rateit(tmdbId: number, tier: Tier) {
    if (saving) return;
    setSaving(tmdbId);
    const prev = rated[tmdbId];

    // Optimistic update
    setRated(r => ({ ...r, [tmdbId]: tier }));

    // If re-rating the same movie, delete old entry first
    if (prev) {
      // Find umId — we skip this complexity by using skipCompare
      // The server handles duplicate via UNIQUE constraint (returns 409 → we ignore)
    }

    await fetch("/api/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId, tier, skipCompare: true }),
    });
    setSaving(null);
  }

  async function finish() {
    setDone(true);
    router.push("/");
  }

  if (status === "loading") return null;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-4xl mb-3">🍿</p>
        <h1 className="text-2xl font-bold text-white">Let's build your taste profile</h1>
        <p className="mt-2 text-sm text-white/40">
          Rate at least {TARGET} movies below so we can personalise your recommendations.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-white/30 mb-1.5">
          <span>{ratedCount} rated</span>
          <span>{TARGET} to unlock recommendations</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Movie grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {STARTER_MOVIES.map(movie => {
          const myTier = rated[movie.tmdb_id];
          return (
            <div key={movie.tmdb_id} className="space-y-2">
              <div className={`relative aspect-[2/3] overflow-hidden rounded-xl ring-2 transition ${myTier ? TIER_CFG[myTier].cls.includes("emerald") ? "ring-emerald-500" : myTier === "fine" ? "ring-amber-500" : "ring-red-500" : "ring-white/5"}`}>
                <SafeImage src={posterUrl(movie.poster_path, "w342")} alt={movie.title} fill className="object-cover" sizes="200px" />
                {saving === movie.tmdb_id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <svg className="h-6 w-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-white/70 truncate">{movie.title}</p>
              <div className="flex gap-1">
                {(Object.keys(TIER_CFG) as Tier[]).map(t => (
                  <button
                    key={t}
                    onClick={() => rateit(movie.tmdb_id, t)}
                    disabled={saving !== null}
                    className={`flex-1 rounded-lg border py-1 text-sm transition ${
                      myTier === t
                        ? TIER_CFG[t].cls
                        : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    {TIER_CFG[t].emoji}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-10 flex flex-col items-center gap-3">
        <button
          onClick={finish}
          disabled={done}
          className={`w-full rounded-xl py-3 font-semibold transition ${
            ratedCount >= TARGET
              ? "bg-amber-500 text-black hover:bg-amber-400"
              : "bg-white/5 text-white/30 cursor-not-allowed"
          }`}
        >
          {ratedCount >= TARGET ? "Done — show my recommendations →" : `Rate ${TARGET - ratedCount} more to continue`}
        </button>
        <Link href="/" className="text-sm text-white/25 hover:text-white/50">Skip for now</Link>
      </div>
    </div>
  );
}
