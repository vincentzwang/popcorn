"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { scoreColor } from "@/lib/scoring";

interface Stats {
  totalMovies: number;
  totalHours: number;
  totalMinutes: number;
  avgScore: number | null;
  streak: number;
  tiers: { liked: number; fine: number; disliked: number };
  topGenres: Array<{ name: string; count: number }>;
  topDirectors: Array<{ director: string; count: number }>;
  watchPartners: Array<{ username: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
  scoreDistrib: { high: number; mid: number; low: number };
  personality: { title: string; emoji: string; desc: string };
  firstRating: string | null;
}

function StatCard({ label, value, sub, color = "text-white" }: {
  label: string; value: React.ReactNode; sub?: string; color?: string;
}) {
  return (
    <div className="depth-card rounded-2xl p-5">
      <p className="text-xs font-medium uppercase tracking-widest text-white/30">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

function Bar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-right text-xs text-white/50">{label}</span>
      <div className="relative flex-1 h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-xs text-white/40">{count}</span>
    </div>
  );
}

function MonthChart({ data }: { data: Array<{ month: string; count: number }> }) {
  if (data.length === 0) return <p className="text-xs text-white/20">No data yet.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const months = data.slice(-12);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {months.map((m) => (
        <div key={m.month} className="group relative flex-1 flex flex-col items-center justify-end h-full">
          <div
            className="w-full rounded-t bg-amber-500/60 transition-all hover:bg-amber-500"
            style={{ height: `${Math.max(4, (m.count / max) * 100)}%` }}
          />
          <div className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {m.month}: {m.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUsername = searchParams.get("user");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const myUsername = (session?.user as { username?: string })?.username;
  const displayName = targetUsername ?? myUsername;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/signin"); return; }
    if (status !== "authenticated") return;
    const url = targetUsername ? `/api/stats?username=${targetUsername}` : "/api/stats";
    fetch(url).then((r) => r.json()).then((d) => { setStats(d); setLoading(false); });
  }, [status, targetUsername, router]);

  if (loading || !stats) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 h-8 w-48 animate-pulse rounded-lg bg-white/5" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  const { totalMovies, totalHours, avgScore, streak, tiers, topGenres, topDirectors, monthly, scoreDistrib, personality, firstRating, watchPartners } = stats;
  const maxTier = Math.max(tiers.liked, tiers.fine, tiers.disliked, 1);
  const maxGenre = topGenres[0]?.count ?? 1;
  const memberSince = firstRating ? new Date(firstRating).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;

  // Fun runtime comparison
  const hoursDesc = totalHours >= 200
    ? `${Math.round(totalHours / 24)} full days of film`
    : totalHours >= 10
    ? `${Math.round(totalHours / 2)} round-trip flights NYC→LA`
    : "just getting started";

  return (
    <div className="mx-auto max-w-3xl space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-white/30">
            {displayName === myUsername ? "Your" : `${displayName}'s`} stats
          </p>
          <h1 className="text-2xl font-bold text-white">Movie Stats</h1>
          {memberSince && <p className="mt-0.5 text-xs text-white/25">Member since {memberSince}</p>}
        </div>
        {displayName !== myUsername && (
          <Link href={`/profile/${displayName}`} className="text-xs text-amber-400 hover:underline">
            ← Back to profile
          </Link>
        )}
      </div>

      {/* ── TOP STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Movies watched" value={totalMovies} />
        <StatCard
          label="Hours on screen"
          value={`${totalHours}h`}
          sub={totalHours > 0 ? hoursDesc : undefined}
          color="text-amber-400"
        />
        <StatCard
          label="Avg score"
          value={avgScore !== null ? avgScore.toFixed(1) : "—"}
          color={avgScore !== null ? scoreColor(avgScore) : "text-white/30"}
        />
        <StatCard
          label="Longest streak"
          value={streak > 0 ? `${streak}w` : "—"}
          sub={streak > 0 ? `${streak === 1 ? "week" : "weeks"} in a row` : "rate weekly!"}
          color="text-violet-400"
        />
      </div>

      {/* ── PERSONALITY CARD ── */}
      {totalMovies >= 3 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-6" style={{boxShadow:"inset 0 1px 0 rgba(251,191,36,0.1), 0 4px 24px rgba(0,0,0,0.3)"}}>
          <div className="flex items-start gap-4">
            <span className="text-5xl">{personality.emoji}</span>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-amber-400/70">Your movie personality</p>
              <h2 className="mt-1 text-2xl font-bold text-white">{personality.title}</h2>
              <p className="mt-1 text-sm text-white/50">{personality.desc}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TWO-COLUMN DETAILS ── */}
      <div className="grid gap-4 sm:grid-cols-2">

        {/* Tier breakdown */}
        <div className="depth-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Rating breakdown</h3>
          <div className="space-y-3">
            <Bar label="😍 Liked" count={tiers.liked} max={maxTier} color="bg-emerald-500" />
            <Bar label="😐 Fine" count={tiers.fine} max={maxTier} color="bg-amber-500" />
            <Bar label="👎 Disliked" count={tiers.disliked} max={maxTier} color="bg-red-500" />
          </div>
          {totalMovies > 0 && (
            <p className="text-xs text-white/25">
              {Math.round((tiers.liked / totalMovies) * 100)}% liked · {Math.round((tiers.disliked / totalMovies) * 100)}% disliked
            </p>
          )}
        </div>

        {/* Score distribution */}
        <div className="depth-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Score distribution</h3>
          <div className="space-y-3">
            <Bar label="7 – 10 (great)" count={scoreDistrib.high ?? 0} max={Math.max(scoreDistrib.high, scoreDistrib.mid, scoreDistrib.low, 1)} color="bg-emerald-500" />
            <Bar label="4 – 7 (ok)" count={scoreDistrib.mid ?? 0} max={Math.max(scoreDistrib.high, scoreDistrib.mid, scoreDistrib.low, 1)} color="bg-amber-500" />
            <Bar label="1 – 4 (bad)" count={scoreDistrib.low ?? 0} max={Math.max(scoreDistrib.high, scoreDistrib.mid, scoreDistrib.low, 1)} color="bg-red-500" />
          </div>
        </div>

        {/* Top genres */}
        <div className="depth-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Top genres you love</h3>
          {topGenres.length === 0 ? (
            <p className="text-xs text-white/25">Rate more movies to see genre stats.</p>
          ) : (
            <div className="space-y-3">
              {topGenres.map((g) => (
                <Bar key={g.name} label={g.name} count={g.count} max={maxGenre} color="bg-violet-500" />
              ))}
            </div>
          )}
        </div>

        {/* Top directors */}
        <div className="depth-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Directors you watch most</h3>
          {topDirectors.length === 0 ? (
            <p className="text-xs text-white/25">Rate more movies to see director stats.</p>
          ) : (
            <div className="space-y-3">
              {topDirectors.map((d) => (
                <Bar key={d.director} label={d.director} count={d.count}
                  max={topDirectors[0].count} color="bg-sky-500" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── WATCH PARTNERS ── */}
      {watchPartners?.length > 0 && (
        <div className="depth-card rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">🎟️ Watched together with</h3>
          <div className="space-y-3">
            {watchPartners.map((p) => (
              <div key={p.username} className="flex items-center gap-3">
                <Link href={`/profile/${p.username}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold uppercase text-amber-400 transition hover:bg-amber-500/30">
                  {p.username[0]}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/compare/${p.username}`} className="text-sm font-medium text-white/80 hover:text-amber-400 transition">
                    {p.username}
                  </Link>
                </div>
                <span className="text-sm font-bold text-white/60">{p.count}</span>
                <span className="text-xs text-white/25">movie{p.count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTHLY ACTIVITY ── */}
      <div className="depth-card rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Monthly activity</h3>
        <MonthChart data={monthly} />
        {monthly.length > 0 && (
          <p className="text-xs text-white/25">
            Most active: {monthly.reduce((a, b) => a.count > b.count ? a : b).month} ({monthly.reduce((a, b) => a.count > b.count ? a : b).count} movies)
          </p>
        )}
      </div>

      {/* ── FUN FACTS ── */}
      {totalMovies > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-center">
          {[
            { emoji: "🎬", label: "movies total", value: totalMovies },
            { emoji: "⏱️", label: "minutes watched", value: stats.totalMinutes > 0 ? stats.totalMinutes.toLocaleString() : "—" },
            { emoji: "🏆", label: "films you loved", value: tiers.liked },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-white/5 bg-white/[0.03] py-4 px-3">
              <p className="text-2xl">{f.emoji}</p>
              <p className="mt-1 text-lg font-bold text-white">{f.value}</p>
              <p className="text-xs text-white/30">{f.label}</p>
            </div>
          ))}
        </div>
      )}

      {totalMovies === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-white/40">No stats yet.</p>
          <Link href="/search" className="mt-4 inline-block rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400">
            Rate your first movie
          </Link>
        </div>
      )}
    </div>
  );
}

export default function StatsPage() {
  return <Suspense><StatsInner /></Suspense>;
}
