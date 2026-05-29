"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface GenreItem { name: string; count: number; }

const GENRE_EMOJI: Record<string, string> = {
  "Action": "⚡", "Drama": "🎭", "Comedy": "😂", "Horror": "👻",
  "Science Fiction": "🚀", "Romance": "💘", "Thriller": "🎯",
  "Animation": "✨", "Documentary": "🔍", "Crime": "🕵️",
  "Adventure": "🌍", "Fantasy": "🧙", "History": "⏳", "War": "🎖️",
  "Music": "🎵", "Mystery": "🔮", "Family": "👨‍👩‍👧", "Western": "🤠",
};

export default function BrowsePage() {
  const [genres, setGenres] = useState<GenreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/browse").then(r => r.json()).then(d => { setGenres(d); setLoading(false); });
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Browse by genre</h1>
      <p className="mb-8 text-sm text-white/40">Explore movies by genre, sorted by Popcorn ratings.</p>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {[...Array(12)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {genres.map(g => (
            <Link key={g.name} href={`/browse/${g.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4 transition hover:border-amber-500/20 hover:bg-white/[0.06]">
              <span className="text-2xl">{GENRE_EMOJI[g.name] ?? "🎬"}</span>
              <div>
                <p className="font-medium text-white/80">{g.name}</p>
                <p className="text-xs text-white/25">{g.count} movie{g.count !== 1 ? "s" : ""}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
