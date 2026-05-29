"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import WatchedWithPicker from "@/components/WatchedWithPicker";

interface TmdbResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview: string;
}

type Tier = "liked" | "fine" | "disliked";

const TIER_CONFIG = {
  liked: {
    label: "Liked",
    emoji: "😍",
    desc: "You enjoyed it",
    cls: "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300",
    selCls: "border-emerald-500 bg-emerald-500/30 text-emerald-200",
  },
  fine: {
    label: "Fine",
    emoji: "😐",
    desc: "It was okay",
    cls: "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300",
    selCls: "border-amber-500 bg-amber-500/30 text-amber-200",
  },
  disliked: {
    label: "Disliked",
    emoji: "👎",
    desc: "Not for you",
    cls: "border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-300",
    selCls: "border-red-500 bg-red-500/30 text-red-200",
  },
};

function SearchInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadTmdbId = searchParams.get("tmdbId");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TmdbResult | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [review, setReview] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  // Auto-select movie when arriving from a movie detail page
  useEffect(() => {
    if (!preloadTmdbId || selected) return;
    fetch(`/api/movies/${preloadTmdbId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.movie) {
          setSelected({
            id: d.movie.tmdb_id,
            title: d.movie.title,
            poster_path: d.movie.poster_path,
            release_date: d.movie.release_year ? `${d.movie.release_year}-01-01` : "",
            overview: d.movie.overview ?? "",
          });
        }
      })
      .catch(() => {});
  }, [preloadTmdbId, selected]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setLoading(false);
    }, 350);
  }, [query]);

  async function handleRate() {
    if (!selected || !tier) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: selected.id, tier, review, watchedWith: watchedWith || undefined }),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/signin");
          return;
        }
        if (res.status === 409) {
          alert("You've already rated this movie!");
        } else {
          alert((data.error as string) ?? `Error ${res.status}. Please try again.`);
        }
        return;
      }

      if (data.done) {
        router.push("/profile");
      } else {
        router.push(`/compare?umId=${data.umId}&compareWith=${data.compareWith}&low=${data.low}&high=${data.high}&tier=${tier}`);
      }
    } catch (err) {
      console.error("Rate failed:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-white">Rate a movie</h1>

      {!selected ? (
        <>
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a movie…"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder-white/30 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-3 space-y-2">
              {results.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => setSelected(movie)}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:border-white/10 hover:bg-white/10"
                >
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    <SafeImage
                      src={posterUrl(movie.poster_path, "w92")}
                      alt={movie.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{movie.title}</p>
                    <p className="text-sm text-white/40">
                      {movie.release_date?.slice(0, 4) ?? "Unknown year"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-white/30">{movie.overview}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <p className="mt-8 text-center text-white/30">
              No results found.
            </p>
          )}
        </>
      ) : (
        <div>
          {/* Selected movie card */}
          <div className="mb-6 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
              <SafeImage
                src={posterUrl(selected.poster_path)}
                alt={selected.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-white">{selected.title}</h2>
              <p className="text-sm text-white/40">{selected.release_date?.slice(0, 4)}</p>
              <p className="mt-1 line-clamp-2 text-sm text-white/50">{selected.overview}</p>
            </div>
            <button
              onClick={() => { setSelected(null); setTier(null); }}
              className="shrink-0 rounded-lg p-1 text-white/30 transition hover:text-white/60"
            >
              ✕
            </button>
          </div>

          {/* Tier selection */}
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/40">
            How was it?
          </h3>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {(Object.entries(TIER_CONFIG) as [Tier, typeof TIER_CONFIG[Tier]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setTier(key)}
                className={`rounded-2xl border px-4 py-5 text-center transition ${
                  tier === key ? cfg.selCls : cfg.cls
                }`}
              >
                <div className="mb-1 text-2xl">{cfg.emoji}</div>
                <div className="font-semibold">{cfg.label}</div>
                <div className="mt-0.5 text-xs opacity-70">{cfg.desc}</div>
              </button>
            ))}
          </div>

          {/* Watched with */}
          <div className="mb-5">
            <WatchedWithPicker value={watchedWith} onChange={setWatchedWith} />
          </div>

          {/* Optional review */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-white/50">
              Review <span className="text-white/30">(optional)</span>
            </label>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Share your thoughts…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-amber-500/40"
            />
          </div>

          <button
            onClick={handleRate}
            disabled={!tier || submitting}
            className="w-full rounded-xl bg-amber-500 py-3 font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40"
          >
            {submitting ? "Saving…" : tier ? "Continue →" : "Select how you felt first"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
