"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import { tierColor, tierLabel } from "@/lib/scoring";
import type { Tier } from "@/lib/scoring";

interface Movie {
  tmdb_id: number; title: string;
  poster_path: string | null; release_year: number | null;
}

interface Conflict {
  movie: Movie; myTier: string; theirTier: string; scoreDiff: number | null;
}

interface Factor {
  value: number; label: string; desc: string;
}

interface CompatData {
  score: number | null;
  shared: number;
  confidence: "high" | "medium" | "low";
  factors: { scores: Factor; genres: Factor; style: Factor; patterns: Factor };
  both: Movie[];
  conflicts: Conflict[];
  onlyThem: Movie[];
  onlyMe: Movie[];
  myAvgScore: number | null;
  theirAvgScore: number | null;
  myTopGenres?: string[];
  theirTopGenres?: string[];
  sharedGenres?: string[];
  watchedTogether?: number;
}

const tierEmoji: Record<string, string> = { liked: "😍", fine: "😐", disliked: "👎" };

function compatLabel(s: number) {
  if (s >= 88) return { text: "Cinematic soulmates", color: "text-emerald-400" };
  if (s >= 75) return { text: "Film twins",           color: "text-emerald-400" };
  if (s >= 62) return { text: "Great match",          color: "text-amber-400" };
  if (s >= 50) return { text: "Solid overlap",        color: "text-amber-400" };
  if (s >= 38) return { text: "Different tastes",     color: "text-orange-400" };
  if (s >= 25) return { text: "Rarely agree",         color: "text-red-400" };
  return              { text: "Opposites",             color: "text-red-400" };
}

function factorColor(v: number) {
  if (v >= 70) return "bg-emerald-500";
  if (v >= 45) return "bg-amber-500";
  return "bg-red-500";
}

function FactorBar({ factor }: { factor: Factor }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-white/70">{factor.label}</span>
        <span className="text-sm font-bold text-white">{factor.value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full transition-all duration-700 ${factorColor(factor.value)}`}
          style={{ width: `${factor.value}%` }} />
      </div>
      <p className="text-xs text-white/30">{factor.desc}</p>
    </div>
  );
}

function MiniPoster({ movie }: { movie: Movie }) {
  return (
    <Link href={`/movies/${movie.tmdb_id}`} className="group block w-[88px] shrink-0">
      <div className="poster-shadow relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/5 transition group-hover:ring-amber-500/40 group-hover:scale-[1.04]">
        <SafeImage src={posterUrl(movie.poster_path, "w185")} alt={movie.title} fill className="object-cover" sizes="88px" />
      </div>
      <p className="mt-1 truncate px-0.5 text-[11px] text-white/40 group-hover:text-white/70">{movie.title}</p>
    </Link>
  );
}

function PosterRow({ movies }: { movies: Movie[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {movies.map(m => <MiniPoster key={m.tmdb_id} movie={m} />)}
    </div>
  );
}

// CSS conic-gradient ring — no SVG, no overflow, score centred perfectly
function CompatRing({ score }: { score: number }) {
  const { color } = compatLabel(score);
  const colorMap: Record<string, string> = {
    "text-emerald-400": "#34d399",
    "text-amber-400":   "#fbbf24",
    "text-orange-400":  "#fb923c",
    "text-red-400":     "#f87171",
  };
  const fill = colorMap[color] ?? "#fbbf24";
  const deg  = Math.round(score * 3.6); // 0–360

  return (
    <div
      className="relative flex h-24 w-24 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${fill} ${deg}deg, rgba(255,255,255,0.06) ${deg}deg)`,
        boxShadow: `0 0 18px 2px ${fill}33`,
      }}
    >
      {/* Inner fill hides the conic-gradient to create the ring */}
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
        style={{ background: "var(--bg-mid, #0d0d0f)" }}>
        <span className={`text-2xl font-bold ${color}`}>{score}%</span>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const { username } = useParams<{ username: string }>();
  const { data: session } = useSession();
  const [data, setData] = useState<CompatData | null>(null);
  const [loading, setLoading] = useState(true);
  const myUsername = (session?.user as { username?: string })?.username;

  useEffect(() => {
    fetch(`/api/compatibility/${username}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [username]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="text-white/30 text-sm">Analysing taste profiles…</div>
          <div className="flex gap-1 justify-center">
            {[0,1,2].map(i => (
              <div key={i} className="h-1.5 w-8 rounded-full bg-amber-500/30 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasScore = data.score !== null;
  const label = hasScore ? compatLabel(data.score!) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">

      {/* Back */}
      <Link href={`/profile/${username}`} className="inline-flex items-center gap-1 text-sm text-white/30 hover:text-white/60">
        ← {username}&apos;s profile
      </Link>

      {/* ── SCORE HERO ── */}
      <div className="depth-card relative overflow-hidden rounded-2xl p-6">
        {/* Ambient glow */}
        {hasScore && (
          <div className="pointer-events-none absolute inset-0 opacity-20"
            style={{ background: `radial-gradient(ellipse at 50% 100%, ${label!.color.includes("emerald") ? "#10b981" : label!.color.includes("amber") ? "#f59e0b" : "#ef4444"} 0%, transparent 60%)` }} />
        )}

        {!hasScore ? (
          <div className="py-8 text-center">
            <p className="text-4xl mb-3">🎬</p>
            <p className="text-lg font-bold text-white">No movies in common yet</p>
            <p className="mt-1 text-sm text-white/40">Rate more movies to unlock your compatibility score.</p>
          </div>
        ) : (
          /* Two-column layout: avatars on the sides, score in the middle */
          <div className="flex items-center gap-4">

            {/* My info — left */}
            <div className="flex flex-col items-center gap-1 w-20 shrink-0">
              <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center text-lg font-bold text-amber-400">
                {myUsername?.[0]?.toUpperCase()}
              </div>
              <p className="text-xs text-white/50 text-center leading-tight">{myUsername}</p>
              {data.myAvgScore != null && (
                <p className="text-[11px] text-white/25">avg {data.myAvgScore.toFixed(1)}</p>
              )}
            </div>

            {/* Score — centre */}
            <div className="flex-1 flex flex-col items-center">
              {/* Ring */}
              <CompatRing score={data.score!} />
              <p className={`mt-2 text-sm font-semibold ${label!.color}`}>{label!.text}</p>
              <p className="mt-1 text-[11px] text-white/30 text-center">
                {data.shared} movies in common
                {(data.watchedTogether ?? 0) > 0 && ` · 🎟️ ${data.watchedTogether} watched together`}
                {data.confidence === "low" && " · rate more for a better estimate"}
              </p>
            </div>

            {/* Their info — right */}
            <div className="flex flex-col items-center gap-1 w-20 shrink-0">
              <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center text-lg font-bold text-violet-400">
                {username[0].toUpperCase()}
              </div>
              <p className="text-xs text-white/50 text-center leading-tight">{username}</p>
              {data.theirAvgScore != null && (
                <p className="text-[11px] text-white/25">avg {data.theirAvgScore.toFixed(1)}</p>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── FACTOR BREAKDOWN ── */}
      {hasScore && data.factors && (
        <div className="depth-card rounded-2xl p-5 space-y-5">
          <h2 className="border-l-2 border-amber-500/70 pl-3 text-[15px] font-semibold tracking-tight text-white">
            What drives your score
          </h2>
          {Object.values(data.factors).map((f, i) => (
            <FactorBar key={i} factor={f} />
          ))}
        </div>
      )}

      {/* ── GENRE BREAKDOWN ── */}
      {((data.myTopGenres?.length ?? 0) > 0 || (data.theirTopGenres?.length ?? 0) > 0) && (
        <div className="depth-card rounded-2xl p-5 space-y-4">
          <h2 className="border-l-2 border-amber-500/70 pl-3 text-[15px] font-semibold tracking-tight text-white">Genre comparison</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-white/40">{myUsername}&apos;s top genres</p>
              <div className="flex flex-wrap gap-1.5">
                {(data.myTopGenres ?? []).map(g => (
                  <span key={g} className={`rounded-full border px-2 py-0.5 text-xs ${(data.sharedGenres ?? []).includes(g) ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-white/40">{username}&apos;s top genres</p>
              <div className="flex flex-wrap gap-1.5">
                {(data.theirTopGenres ?? []).map(g => (
                  <span key={g} className={`rounded-full border px-2 py-0.5 text-xs ${(data.sharedGenres ?? []).includes(g) ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {(data.sharedGenres?.length ?? 0) > 0 && (
            <p className="text-xs text-emerald-400/80">✓ You both love: {data.sharedGenres!.join(", ")}</p>
          )}
        </div>
      )}

      {/* ── MOVIES YOU BOTH LOVED ── */}
      {data.both.length > 0 && (
        <section className="space-y-3">
          <h2 className="border-l-2 border-emerald-500/70 pl-3 text-[15px] font-semibold tracking-tight text-white">
            You both loved 😍
          </h2>
          <PosterRow movies={data.both} />
        </section>
      )}

      {/* ── CONFLICTS ── */}
      {data.conflicts.length > 0 && (
        <section className="space-y-3">
          <h2 className="border-l-2 border-red-500/70 pl-3 text-[15px] font-semibold tracking-tight text-white">
            Biggest disagreements ⚡
          </h2>
          <div className="space-y-2">
            {data.conflicts.map((c, i) => (
              <Link key={i} href={`/movies/${c.movie.tmdb_id}`}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 transition hover:bg-white/[0.05]">
                <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-lg bg-white/5">
                  <SafeImage src={posterUrl(c.movie.poster_path, "w92")} alt={c.movie.title} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/80">{c.movie.title}</p>
                  {c.scoreDiff !== null && (
                    <p className="text-xs text-white/25">{c.scoreDiff.toFixed(1)} point gap</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className={tierColor(c.myTier as Tier)}>{tierEmoji[c.myTier]} {tierLabel(c.myTier as Tier)}</span>
                  <span className="text-white/20">·</span>
                  <span className={tierColor(c.theirTier as Tier)}>{tierEmoji[c.theirTier]} {tierLabel(c.theirTier as Tier)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── THEY'VE SEEN, YOU HAVEN'T ── */}
      {data.onlyThem.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="border-l-2 border-amber-500/70 pl-3 text-[15px] font-semibold tracking-tight text-white">
              {username} has seen, you haven&apos;t
            </h2>
            <p className="mt-0.5 pl-3 text-xs text-white/30">Good watchlist candidates</p>
          </div>
          <PosterRow movies={data.onlyThem} />
        </section>
      )}

      {/* ── YOU'VE SEEN, THEY HAVEN'T ── */}
      {data.onlyMe.length > 0 && (
        <section className="space-y-3">
          <h2 className="border-l-2 border-white/20 pl-3 text-[15px] font-semibold tracking-tight text-white">
            You&apos;ve seen, {username} hasn&apos;t
          </h2>
          <PosterRow movies={data.onlyMe} />
        </section>
      )}

      {!hasScore && data.onlyThem.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/8 py-14 text-center">
          <p className="text-sm text-white/30">Start rating movies to compare with {username}.</p>
          <Link href="/search" className="mt-3 inline-block rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400">
            Rate movies →
          </Link>
        </div>
      )}
    </div>
  );
}
