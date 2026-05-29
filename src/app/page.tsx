"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import { scoreColor } from "@/lib/scoring";
import { parseProviders, topProviders, providerStyle } from "@/lib/streaming";
import type { Tier } from "@/lib/scoring";
import FeedItem, { type FeedEntry } from "@/components/FeedItem";

interface MovieCard {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  director?: string | null;
  overview?: string | null;
  rating_count?: number;
  avg_score?: number | null;
  release_date?: string;
  streaming?: string | null;
  because?: string | null;
}


// ── Movie poster card (used in all scroll rows) ────────────────────────────
function MovieCard({ movie, badge, watchlistIds, onWatchlist }: {
  movie: MovieCard; badge?: string;
  watchlistIds?: Set<number>;
  onWatchlist?: (tmdbId: number) => void;
}) {
  const providers = topProviders(parseProviders(movie.streaming ?? null), 2);
  const inWl = watchlistIds?.has(movie.tmdb_id);

  return (
    <div className="group relative w-[130px] shrink-0">
      <Link href={`/movies/${movie.tmdb_id}`} className="block">
        <div className="poster-shadow relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/5 transition duration-200 group-hover:ring-amber-500/50 group-hover:scale-[1.03]">
          <SafeImage src={posterUrl(movie.poster_path, "w342")} alt={movie.title} fill className="object-cover" sizes="130px" />
          {badge && <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-black shadow">{badge}</span>}
          {!badge && movie.avg_score != null && movie.rating_count! > 0 && (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-sm">{movie.avg_score.toFixed(1)}</span>
          )}
          {/* Streaming badges bottom-left */}
          {providers.length > 0 && (
            <div className="absolute bottom-1.5 left-1.5 flex gap-0.5">
              {providers.map(p => {
                const s = providerStyle(p.id);
                return (
                  <span key={p.id} title={p.name} className="flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[9px] font-bold" style={{ background: s.bg, color: s.text }}>
                    {s.abbr}
                  </span>
                );
              })}
            </div>
          )}
          {/* Watchlist toggle — visible on hover */}
          {onWatchlist && (
            <button onClick={e => { e.preventDefault(); onWatchlist(movie.tmdb_id); }}
              className={`absolute right-1.5 bottom-1.5 rounded-full p-1 text-sm opacity-0 transition group-hover:opacity-100 ${inWl ? "bg-amber-500/80 text-black" : "bg-black/60 text-white/60 hover:text-amber-400"}`}>
              {inWl ? "🔖" : "+"}
            </button>
          )}
        </div>
      </Link>
      <div className="mt-2 space-y-0.5 px-0.5">
        <p className="truncate text-xs font-medium text-white/75">{movie.title}</p>
        {movie.because
          ? <p className="truncate text-[10px] text-amber-400/60 italic">{movie.because}</p>
          : <p className="text-[11px] text-white/25">{movie.release_year}</p>
        }
      </div>
    </div>
  );
}

// ── Horizontal scroll row ──────────────────────────────────────────────────
function ScrollRow({ children, loading, count = 10 }: { children?: React.ReactNode; loading: boolean; count?: number }) {
  return (
    <div className="relative -mx-4 px-4">
      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
        {loading
          ? [...Array(count)].map((_, i) => (
              <div key={i} className="w-[130px] shrink-0">
                <div className="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.06]" />
                <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-white/[0.04]" />
              </div>
            ))
          : children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0d0d0f]/90 to-transparent" />
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="border-l-2 border-amber-500/70 pl-3 text-[15px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        {action && <div className="text-xs text-white/30">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function HomePage() {
  const { data: session } = useSession();
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [feedCursor, setFeedCursor] = useState<number | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const feedSentinel = useRef<HTMLDivElement>(null);
  const [topRated, setTopRated] = useState<MovieCard[]>([]);
  const [unrated, setUnrated] = useState<MovieCard[]>([]);
  const [newReleases, setNewReleases] = useState<MovieCard[]>([]);
  const [recs, setRecs] = useState<MovieCard[]>([]);
  const [recTip, setRecTip] = useState("");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingNew, setLoadingNew] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recsFetched, setRecsFetched] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<Set<number>>(new Set());
  const username = (session?.user as { username?: string })?.username;

  useEffect(() => {
    fetch("/api/feed").then(r => r.json()).then(d => {
      setFeed(d.items ?? d); setFeedCursor(d.nextCursor ?? null);
      setFeedHasMore(d.hasMore ?? false); setLoadingFeed(false);
    });
    fetch("/api/movies/popular").then((r) => r.json()).then((d) => {
      setTopRated(d.topRated ?? []);
      setUnrated(d.unrated ?? []);
      setLoadingMovies(false);
    });
    fetch("/api/movies/new-releases").then((r) => r.json()).then((d) => {
      setNewReleases(d);
      setLoadingNew(false);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch("/api/watchlist").then(r => r.json()).then((items: { tmdb_id: number }[]) => {
      setWatchlistIds(new Set(items.map(i => i.tmdb_id)));
    });
  }, [session]);

  async function toggleWatchlist(tmdbId: number) {
    setWatchlistIds(prev => {
      const next = new Set(prev);
      if (next.has(tmdbId)) next.delete(tmdbId); else next.add(tmdbId);
      return next;
    });
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId }) });
  }

  useEffect(() => {
    if (!session || recsFetched) return;
    setRecsFetched(true);
    setLoadingRecs(true);
    fetch("/api/recommendations")
      .then((r) => r.json())
      .then((d) => { setRecs(d.recommendations ?? []); setRecTip(d.tip ?? ""); setLoadingRecs(false); })
      .catch(() => setLoadingRecs(false));
  }, [session, recsFetched]);

  const refreshRecs = useCallback(() => {
    setLoadingRecs(true);
    fetch("/api/recommendations?refresh=1")
      .then((r) => r.json())
      .then((d) => { setRecs(d.recommendations ?? []); setLoadingRecs(false); })
      .catch(() => setLoadingRecs(false));
  }, []);

  const loadMoreFeed = useCallback(async () => {
    if (loadingMoreFeed || !feedHasMore || !feedCursor) return;
    setLoadingMoreFeed(true);
    const d = await fetch(`/api/feed?before=${feedCursor}`).then(r => r.json());
    setFeed(prev => [...prev, ...(d.items ?? [])]);
    setFeedCursor(d.nextCursor ?? null);
    setFeedHasMore(d.hasMore ?? false);
    setLoadingMoreFeed(false);
  }, [loadingMoreFeed, feedHasMore, feedCursor]);

  // Intersection Observer on the sentinel div at bottom of feed
  useEffect(() => {
    const el = feedSentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMoreFeed(); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMoreFeed]);

  const newBadge = (m: MovieCard) => {
    if (!m.release_date) return undefined;
    const days = Math.floor((Date.now() - new Date(m.release_date).getTime()) / 86400000);
    if (days <= 0) return "Today";
    if (days <= 7) return `${days}d ago`;
    return undefined;
  };

  return (
    <div className="space-y-12">

      {/* ── HERO (logged out) ─────────────────────────────────────────────── */}
      {!session && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/10 bg-gradient-to-br from-[#1c1508] via-[#13110d] to-[#0d0d0f] px-8 py-16 text-center" style={{boxShadow:"inset 0 1px 0 rgba(251,191,36,0.08)"}}>
          {/* decorative glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative">
            <p className="mb-5 text-5xl">🍿</p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Rate movies the <span className="text-amber-400">right</span> way
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/40">
              Skip the arbitrary stars. Pick liked, fine, or disliked — then compare films head-to-head. Your ranking emerges from real preferences.
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <Link href="/signup" className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400">
                Get started — it&apos;s free
              </Link>
              <Link href="/signin" className="rounded-full border border-white/10 px-6 py-2.5 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── GREETING (logged in) ──────────────────────────────────────────── */}
      {session && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">
              Hey, <span className="text-amber-400">{username}</span>
            </h1>
            <p className="mt-0.5 text-sm text-white/40">What did you watch recently?</p>
          </div>
          <Link
            href="/search"
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            + Rate a movie
          </Link>
        </div>
      )}

      {/* ── NEW IN THEATERS ───────────────────────────────────────────────── */}
      <Section title="🎬 New in Theaters">
        <ScrollRow loading={loadingNew}>
          {newReleases.map((m) => (
            <MovieCard key={m.tmdb_id} movie={m} badge={newBadge(m)} watchlistIds={watchlistIds} onWatchlist={session ? toggleWatchlist : undefined} />
          ))}
        </ScrollRow>
      </Section>

      {/* ── AI RECOMMENDATIONS (logged in) ───────────────────────────────── */}
      {session && (
        <Section
          title={
            <span className="flex items-center gap-2">
              ✨ Picked for you
              {loadingRecs && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-white/30">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Thinking…
                </span>
              )}
            </span>
          }
          action={
            recs.length > 0 && !loadingRecs ? (
              <button onClick={refreshRecs} className="transition hover:text-white/60">
                ↻ Refresh
              </button>
            ) : undefined
          }
        >
          {!loadingRecs && recs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 py-10 text-center">
              <p className="text-sm text-white/30">
                {recTip || "Rate a few more movies to unlock personalized picks."}
              </p>
              <Link
                href="/search"
                className="mt-3 inline-block rounded-full bg-white/5 px-4 py-1.5 text-xs text-white/40 transition hover:bg-white/10 hover:text-white/70"
              >
                Start rating →
              </Link>
            </div>
          ) : (
            <ScrollRow loading={loadingRecs}>
              {recs.map((m) => <MovieCard key={m.tmdb_id} movie={m} watchlistIds={watchlistIds} onWatchlist={session ? toggleWatchlist : undefined} />)}
            </ScrollRow>
          )}
        </Section>
      )}

      {/* ── DISCOVER ─────────────────────────────────────────────────────── */}
      <Section
        title={session ? "Movies to rate" : "Browse movies"}
        action={<Link href="/search" className="transition hover:text-white/60">Search all →</Link>}
      >
        <ScrollRow loading={loadingMovies}>
          {unrated.map((m) => <MovieCard key={m.tmdb_id} movie={m} watchlistIds={watchlistIds} onWatchlist={session ? toggleWatchlist : undefined} />)}
        </ScrollRow>
      </Section>

      {/* ── POPULAR ON POPCORN ───────────────────────────────────────────── */}
      <Section title="Popular on Popcorn">
        <ScrollRow loading={loadingMovies}>
          {topRated.map((m) => <MovieCard key={m.tmdb_id} movie={m} watchlistIds={watchlistIds} onWatchlist={session ? toggleWatchlist : undefined} />)}
        </ScrollRow>
      </Section>

      {/* ── ACTIVITY FEED ────────────────────────────────────────────────── */}
      <Section title="Recent ratings">
        {loadingFeed ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 py-12 text-center text-sm text-white/25">
            The credits haven&apos;t rolled yet — be the first to rate something.
          </div>
        ) : (
          <div className="space-y-2">
            {feed.map((entry) => <FeedItem key={entry.id} entry={entry} />)}
            {/* Infinite scroll sentinel */}
            <div ref={feedSentinel} className="py-1">
              {loadingMoreFeed && (
                <div className="flex justify-center py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500/40 border-t-amber-500" />
                </div>
              )}
              {!feedHasMore && feed.length > 0 && (
                <p className="text-center text-xs text-white/15 py-2">You've seen it all ✓</p>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
