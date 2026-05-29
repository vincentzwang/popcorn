"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { posterUrl, backdropUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import { tierColor, tierLabel, scoreColor } from "@/lib/scoring";
import { parseProviders, topProviders, providerStyle } from "@/lib/streaming";
import TimeAgo from "@/components/TimeAgo";
import type { Tier } from "@/lib/scoring";

interface MovieDetail {
  id: number; tmdb_id: number; title: string;
  poster_path: string | null; backdrop_path: string | null;
  release_year: number | null; overview: string | null;
  director: string | null; runtime: number | null;
  genres: string | null; streaming: string | null;
}
interface Rating { um_id: number; tier: Tier; score: number | null; review: string | null; created_at: string; username: string; user_id: number; }
interface Stats { total: number; liked: number; fine: number; disliked: number; avgScore: number | null; }
interface Comment { id: number; body: string; created_at: string; username: string; user_id: number; }

const tierEmoji: Record<Tier, string> = { liked: "😍", fine: "😐", disliked: "👎" };
const tierCls: Record<Tier, string> = {
  liked:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  fine:     "bg-amber-500/15 text-amber-400 border-amber-500/20",
  disliked: "bg-red-500/15 text-red-400 border-red-500/20",
};

function fmtRuntime(min: number | null) {
  if (!min) return null;
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, "-"); }

export default function MoviePage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const username = (session?.user as { username?: string })?.username;
  const myUserId = session?.user ? Number((session.user as { id: string }).id) : null;

  function reload() {
    fetch(`/api/movies/${tmdbId}`).then(r => r.json()).then(d => {
      if (d.movie) { setMovie(d.movie); setRatings(d.ratings); setStats(d.stats); setMyRating(d.myRating); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    fetch(`/api/comments?tmdbId=${tmdbId}`).then(r => r.json()).then(setComments);
    // Fetch trailer key from TMDB
    const key = process.env.NEXT_PUBLIC_TMDB_KEY ?? "";
    if (key) {
      fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${key}`)
        .then(r => r.json()).then(d => {
          const trailer = (d.results ?? []).find(
            (v: { site: string; type: string; official: boolean; key: string }) =>
              v.site === "YouTube" && v.type === "Trailer" && v.official
          ) ?? (d.results ?? []).find((v: { site: string; type: string }) => v.site === "YouTube" && v.type === "Trailer");
          if (trailer) setTrailerKey(trailer.key);
        }).catch(() => {});
    }
    if (session) {
      fetch("/api/watchlist").then(r => r.json()).then((items: { tmdb_id: number }[]) => {
        setInWatchlist(items.some(i => i.tmdb_id === Number(tmdbId)));
      });
    }
  }, [tmdbId, session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleWatchlist() {
    if (!session) { router.push("/signin"); return; }
    setInWatchlist(p => !p);
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId: Number(tmdbId) }) });
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPostingComment(true);
    const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId: Number(tmdbId), body: commentBody }) });
    if (res.ok) {
      const c = await res.json();
      setComments(prev => [...prev, c]);
      setCommentBody("");
    }
    setPostingComment(false);
  }

  async function deleteComment(id: number) {
    await fetch("/api/comments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId: id }) });
    setComments(prev => prev.filter(c => c.id !== id));
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-white/30">Loading…</div>;

  if (!movie) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="text-5xl">🎬</div>
      <p className="text-white/50">This movie isn&apos;t in the database yet.</p>
      <Link href={`/search?tmdbId=${tmdbId}`} className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400">Be the first to rate it</Link>
    </div>
  );

  const genres = movie.genres ? movie.genres.split(",").map(g => g.trim()).filter(Boolean) : [];
  const runtime = fmtRuntime(movie.runtime);
  const providers = topProviders(parseProviders(movie.streaming));
  const pctLiked = stats && stats.total > 0 ? Math.round((stats.liked / stats.total) * 100) : 0;
  const pctFine  = stats && stats.total > 0 ? Math.round((stats.fine / stats.total) * 100) : 0;
  const pctDisliked = stats && stats.total > 0 ? Math.round((stats.disliked / stats.total) * 100) : 0;

  return (
    <div>
      {/* Backdrop */}
      {movie.backdrop_path && (
        <div className="relative -mx-4 -mt-8 mb-6 h-52 overflow-hidden sm:rounded-2xl">
          <SafeImage src={backdropUrl(movie.backdrop_path, "w1280")} alt={movie.title} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/50 to-transparent" />
        </div>
      )}

      {/* Hero */}
      <div className="flex gap-4">
        <div className="poster-shadow relative h-36 w-[96px] shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          <SafeImage src={posterUrl(movie.poster_path, "w342")} alt={movie.title} fill className="object-cover" />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl">{movie.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/40">
            {movie.release_year && <span>{movie.release_year}</span>}
            {runtime && <><span>·</span><span>{runtime}</span></>}
            {movie.director && (
              <><span>·</span>
              <Link href={`/browse/${slugify(movie.director)}?type=director`} className="hover:text-amber-400 transition">
                {movie.director}
              </Link></>
            )}
          </div>
          {/* Genre tags */}
          {genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {genres.map(g => (
                <Link key={g} href={`/browse/${slugify(g)}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/40 transition hover:border-amber-500/30 hover:text-amber-400">
                  {g}
                </Link>
              ))}
            </div>
          )}
          {movie.overview && <p className="mt-2 line-clamp-2 text-xs text-white/50 sm:line-clamp-3 sm:text-sm">{movie.overview}</p>}
        </div>
      </div>

      {/* Trailer + streaming row */}
      {(trailerKey || providers.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {trailerKey && (
            <button onClick={() => setShowTrailer(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400">
              ▶ Watch Trailer
            </button>
          )}
          {providers.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Stream on</span>
              <div className="flex gap-1.5">
                {providers.map(p => {
                  const s = providerStyle(p.id);
                  return (
                    <span key={p.id} title={p.name}
                      className="flex h-6 min-w-[24px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold"
                      style={{ background: s.bg, color: s.text }}>
                      {s.abbr}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trailer modal */}
      {showTrailer && trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowTrailer(false)}>
          <div className="relative w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <button onClick={() => setShowTrailer(false)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Aggregate stats */}
      {stats && stats.total > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-4">
            {stats.avgScore !== null && (
              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-bold ${scoreColor(stats.avgScore)}`}>{stats.avgScore.toFixed(1)}</span>
                <span className="text-sm text-white/30">/ 10</span>
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div className="bg-emerald-500" style={{ width: `${pctLiked}%` }} />
                <div className="bg-amber-500" style={{ width: `${pctFine}%` }} />
                <div className="bg-red-500" style={{ width: `${pctDisliked}%` }} />
              </div>
              <div className="flex gap-3 text-xs text-white/30">
                <span className="text-emerald-400">{pctLiked}% liked</span>
                <span className="text-amber-400">{pctFine}% fine</span>
                <span className="text-red-400">{pctDisliked}% disliked</span>
                <span className="ml-auto">{stats.total} rating{stats.total !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* My rating / CTA */}
      <div className="mt-4 space-y-2">
        {myRating ? (
          <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${tierCls[myRating.tier]}`}>
            <div>
              <p className="text-sm font-semibold">
                {tierEmoji[myRating.tier]} You {tierLabel(myRating.tier).toLowerCase()} this
                {myRating.score !== null && <span className={`ml-2 font-bold ${scoreColor(myRating.score)}`}>{myRating.score.toFixed(1)}</span>}
              </p>
              {myRating.review && <p className="mt-0.5 text-xs opacity-70 italic">&ldquo;{myRating.review}&rdquo;</p>}
            </div>
            <button onClick={() => router.push(`/edit/${myRating.um_id}?tmdbId=${tmdbId}`)}
              className="shrink-0 rounded-lg border border-current/20 px-3 py-1 text-xs font-medium opacity-70 transition hover:opacity-100">
              Edit
            </button>
          </div>
        ) : session ? (
          <Link href={`/search?tmdbId=${tmdbId}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black transition hover:bg-amber-400">
            🍿 Rate this movie
          </Link>
        ) : (
          <Link href="/signup"
            className="flex items-center justify-center rounded-xl bg-amber-500 py-3 text-sm font-semibold text-black hover:bg-amber-400">
            Sign up to rate
          </Link>
        )}

        {/* Watchlist button — shown to all logged-in users whether they've rated or not */}
        {session && (
          <button
            onClick={toggleWatchlist}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
              inWatchlist
                ? "border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/10"
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white"
            }`}
          >
            {inWatchlist ? (
              <><span>🔖</span> In watchlist — tap to remove</>
            ) : (
              <><span>🔖</span> Save to watchlist</>
            )}
          </button>
        )}
      </div>

      {/* Ratings */}
      {ratings.length > 0 && (
        <div className="mt-8 space-y-2">
          <h2 className="text-sm font-semibold text-white">What people think</h2>
          {ratings.map(r => (
            <div key={r.um_id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]">
              <Link href={`/profile/${r.username}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-bold uppercase text-white/70">{r.username[0]}</div>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/profile/${r.username}`} className="text-sm font-medium text-white/80 hover:text-amber-400">{r.username}</Link>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tierCls[r.tier]}`}>{tierEmoji[r.tier]} {tierLabel(r.tier)}</span>
                  {r.score !== null && <span className={`text-sm font-bold ${scoreColor(r.score)}`}>{r.score.toFixed(1)}</span>}
                </div>
                {r.review && <p className="mt-1 text-sm text-white/50 italic">&ldquo;{r.review}&rdquo;</p>}
              </div>
              <span className="shrink-0 text-xs text-white/20"><TimeAgo date={r.created_at} /></span>
            </div>
          ))}
        </div>
      )}

      {/* Comments */}
      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-white">
          Discussion {comments.length > 0 && <span className="ml-1 text-white/30">({comments.length})</span>}
        </h2>

        {comments.map(c => (
          <div key={c.id} className="flex gap-3">
            <Link href={`/profile/${c.username}`}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-bold uppercase text-white/60">{c.username[0]}</div>
            </Link>
            <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/profile/${c.username}`} className="text-xs font-semibold text-amber-400/80 hover:text-amber-400">{c.username}</Link>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/20"><TimeAgo date={c.created_at} /></span>
                  {myUserId === c.user_id && (
                    <button onClick={() => deleteComment(c.id)} className="text-[11px] text-white/20 hover:text-red-400 transition">×</button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-white/70">{c.body}</p>
            </div>
          </div>
        ))}

        {session ? (
          <form onSubmit={postComment} className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold uppercase text-amber-400">{username?.[0]}</div>
            <div className="flex-1 space-y-2">
              <textarea
                ref={commentRef}
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-500/40"
              />
              <button type="submit" disabled={!commentBody.trim() || postingComment}
                className="rounded-full bg-amber-500 px-4 py-1 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40">
                {postingComment ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        ) : (
          <Link href="/signin" className="block rounded-xl border border-dashed border-white/8 py-4 text-center text-xs text-white/30 hover:text-white/50">
            Sign in to join the discussion
          </Link>
        )}
      </div>
    </div>
  );
}
