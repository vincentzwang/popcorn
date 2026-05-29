"use client";
import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";

interface UMInfo {
  id: number;
  tier: string;
  title: string;
  poster_path: string | null;
  release_year: number | null;
  score?: number;
}

function CompareInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const umId = Number(params.get("umId"));
  const compareWith = Number(params.get("compareWith"));
  const low = Number(params.get("low"));
  const high = Number(params.get("high"));
  const tier = params.get("tier") ?? "";

  const [newMovie, setNewMovie] = useState<UMInfo | null>(null);
  const [compareMovie, setCompareMovie] = useState<UMInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/signin"); return; }
    if (!umId || !compareWith) return;

    async function loadMovies() {
      const res = await fetch(`/api/compare/info?ids=${umId},${compareWith}`);
      if (res.ok) {
        const data: UMInfo[] = await res.json();
        setNewMovie(data.find((m) => m.id === umId) ?? null);
        setCompareMovie(data.find((m) => m.id === compareWith) ?? null);
      }
      setLoading(false);
    }
    loadMovies();
  }, [umId, compareWith, status, router]);

  async function choose(winnerId: number, loserId: number) {
    setChoosing(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umId, winnerId, loserId, low, high, tier }),
      });
      const data = await res.json();

      if (data.done) {
        router.push("/profile");
      } else {
        router.push(
          `/compare?umId=${umId}&compareWith=${data.compareWith}&low=${data.low}&high=${data.high}&tier=${tier}`
        );
      }
    } catch (err) {
      console.error("Compare failed:", err);
      router.push("/profile");
    } finally {
      setChoosing(false);
    }
  }

  if (loading || !newMovie || !compareMovie) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-white/40">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/40">
          Which did you prefer?
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Make a comparison</h1>
        <p className="mt-1 text-sm text-white/40">
          This helps us calculate your exact ranking
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[newMovie, compareMovie].map((movie) => (
          <button
            key={movie.id}
            disabled={choosing}
            onClick={() => choose(movie.id, movie.id === newMovie.id ? compareMovie.id : newMovie.id)}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-amber-500/40 hover:bg-white/10 disabled:opacity-50"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-white/5">
              <SafeImage
                src={posterUrl(movie.poster_path, "w342")}
                alt={movie.title}
                fill
                className="object-cover transition group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-bold text-white drop-shadow">{movie.title}</p>
                <p className="text-sm text-white/60">{movie.release_year}</p>
              </div>
            </div>
            <div className="p-3 text-center text-sm font-semibold text-amber-400 opacity-0 transition group-hover:opacity-100">
              I preferred this one
            </div>
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-white/30">
        Both about the same? Pick the one that comes to mind first.
      </p>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <CompareInner />
    </Suspense>
  );
}
