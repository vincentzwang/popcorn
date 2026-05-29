"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";
import { scoreColor } from "@/lib/scoring";

interface Movie {
  tmdb_id: number; title: string; poster_path: string | null;
  release_year: number | null; director: string | null;
  rating_count: number; avg_score: number | null;
}

function BrowseInner() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") ?? "genre"; // "genre" | "director"
  const displayName = slug.replace(/-/g, " ");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const param = type === "director" ? `director=${encodeURIComponent(displayName)}` : `genre=${encodeURIComponent(displayName)}`;
    fetch(`/api/browse?${param}`)
      .then(r => r.json())
      .then(d => { setMovies(d); setLoading(false); });
  }, [slug, type, displayName]);

  return (
    <div>
      <div className="mb-6 flex items-baseline gap-3">
        <Link href="/browse" className="text-sm text-white/30 hover:text-white/60">Browse</Link>
        <span className="text-white/20">/</span>
        <h1 className="text-2xl font-bold text-white capitalize">{displayName}</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-white/5" />)}
        </div>
      ) : movies.length === 0 ? (
        <div className="py-20 text-center text-white/30">No movies found.</div>
      ) : (
        <>
          <p className="mb-4 text-sm text-white/30">{movies.length} movies</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {movies.map(m => (
              <Link key={m.tmdb_id} href={`/movies/${m.tmdb_id}`} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/5 transition group-hover:ring-amber-500/40 group-hover:scale-[1.03]">
                  <SafeImage src={posterUrl(m.poster_path, "w342")} alt={m.title} fill className="object-cover" sizes="180px" />
                  {m.avg_score !== null && m.rating_count > 0 && (
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm" style={{ color: "#f0ede8" }}>
                      <span className={scoreColor(m.avg_score)}>{m.avg_score.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 truncate px-0.5 text-xs font-medium text-white/70 group-hover:text-white">{m.title}</p>
                <p className="px-0.5 text-[11px] text-white/25">{m.release_year}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return <Suspense><BrowseInner /></Suspense>;
}
