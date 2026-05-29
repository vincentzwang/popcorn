"use client";
import { useEffect, useState, useCallback } from "react";
import { posterUrl } from "@/lib/tmdb";
import SafeImage from "@/components/SafeImage";

interface NowPlayingMovie {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview: string;
}

interface Showing { type?: string; time?: string[]; }
interface Theater { name: string; link?: string; address?: string; distance?: string; showtimes?: Showing[]; }
interface ShowtimeDay { day: string | null; theaters?: Theater[]; }
interface ShowtimeResult { showtimes: ShowtimeDay[]; cached?: boolean; error?: string; }

function typeCls(type: string) {
  const t = type.toUpperCase();
  if (t.includes("IMAX"))    return "bg-sky-500/20 text-sky-400 border-sky-500/30";
  if (t.includes("3D") || t.includes("4DX")) return "bg-violet-500/20 text-violet-400 border-violet-500/30";
  if (t.includes("DOLBY") || t.includes("PLF") || t.includes("PREMIUM"))
    return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-white/5 text-white/40 border-white/8";
}

function fandangoUrl(movie: string, city: string) {
  return `https://www.fandango.com/search?q=${encodeURIComponent(movie)}&location=${encodeURIComponent(city)}`;
}

export default function ShowtimesPage() {
  const [movies, setMovies] = useState<NowPlayingMovie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [city, setCity] = useState("");          // resolved city for API
  const [cityInput, setCityInput] = useState(""); // display/input value
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showtimeData, setShowtimeData] = useState<Record<number, ShowtimeResult>>({});
  const [loadingShowtimes, setLoadingShowtimes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch("/api/movies/new-releases")
      .then((r) => r.json())
      .then((d: NowPlayingMovie[]) => { setMovies(d); setLoadingMovies(false); });
  }, []);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError("Geolocation not supported."); return; }
    setLocating(true); setLocError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
            headers: { "Accept-Language": "en" },
          });
          const data = await res.json();
          const a = data.address ?? {};
          const detectedCity = a.city ?? a.town ?? a.village ?? a.county ?? "";
          const state = a.state ?? "";
          const displayCity = [detectedCity, state].filter(Boolean).join(", ");
          setCity(detectedCity || displayCity);
          setCityInput(displayCity);
          setShowtimeData({});
          setExpanded(null);
        } catch { setLocError("Couldn't detect city. Enter it manually."); }
        setLocating(false);
      },
      () => { setLocError("Location denied. Enter your city manually."); setLocating(false); }
    );
  }, []);

  function handleCitySubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    setCity(trimmed.split(",")[0].trim()); // use first part as city for query
    setShowtimeData({});
    setExpanded(null);
  }

  async function fetchShowtimes(movie: NowPlayingMovie) {
    if (!city || showtimeData[movie.tmdb_id]) return;
    setLoadingShowtimes((p) => ({ ...p, [movie.tmdb_id]: true }));
    const res = await fetch(`/api/showtimes?movie=${encodeURIComponent(movie.title)}&city=${encodeURIComponent(city)}`);
    const data: ShowtimeResult = await res.json();
    setShowtimeData((p) => ({ ...p, [movie.tmdb_id]: data }));
    setLoadingShowtimes((p) => ({ ...p, [movie.tmdb_id]: false }));
  }

  function toggleMovie(movie: NowPlayingMovie) {
    if (expanded === movie.tmdb_id) { setExpanded(null); return; }
    setExpanded(movie.tmdb_id);
    fetchShowtimes(movie);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Showtimes</h1>
        <p className="mt-1 text-sm text-white/40">Now playing in theaters — click a movie to see times near you.</p>
      </div>

      {/* Location bar */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">
            {city ? `📍 ${cityInput || city}` : "📍 Where are you?"}
          </p>
          <button
            onClick={detectLocation}
            disabled={locating}
            className="rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/25 disabled:opacity-40"
          >
            {locating ? "Detecting…" : "Use my location"}
          </button>
        </div>
        <form onSubmit={handleCitySubmit} className="flex gap-2">
          <input
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="New York, NY · Los Angeles, CA · Chicago, IL"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-500/40"
          />
          <button type="submit" className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400">
            Search
          </button>
        </form>
        {locError && <p className="text-xs text-red-400">{locError}</p>}
      </div>

      {/* Prompt */}
      {!city && (
        <div className="rounded-2xl border border-dashed border-white/8 py-14 text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-sm text-white/40">Enter your city above to see nearby showtimes.</p>
        </div>
      )}

      {/* Movie list */}
      {city && (
        <div className="space-y-2">
          {loadingMovies
            ? [...Array(6)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)
            : movies.map((movie) => {
                const isOpen = expanded === movie.tmdb_id;
                const result = showtimeData[movie.tmdb_id];
                const busy = loadingShowtimes[movie.tmdb_id];
                const allTheaters = result?.showtimes?.flatMap((d) => d.theaters ?? []) ?? [];

                return (
                  <div key={movie.tmdb_id} className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] transition hover:border-white/8">
                    {/* Movie row — clickable header */}
                    <button
                      onClick={() => toggleMovie(movie)}
                      className="flex w-full items-center gap-4 px-4 py-3 text-left"
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5">
                        <SafeImage src={posterUrl(movie.poster_path, "w92")} alt={movie.title} fill className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">{movie.title}</p>
                        <p className="text-xs text-white/30">{movie.release_date?.slice(0, 10)}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {result && allTheaters.length > 0 && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                            {allTheaters.length} theater{allTheaters.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        {busy
                          ? <svg className="h-4 w-4 animate-spin text-white/30" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          : <span className="text-white/25 text-sm">{isOpen ? "▲" : "▼"}</span>
                        }
                      </div>
                    </button>

                    {/* Showtime panel */}
                    {isOpen && (
                      <div className="border-t border-white/5 px-4 py-5">
                        {busy ? (
                          <div className="space-y-3">
                            {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
                          </div>
                        ) : !result ? (
                          <p className="text-sm text-white/30">Loading…</p>
                        ) : allTheaters.length === 0 ? (
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm text-white/40">
                              No showtimes found near <strong className="text-white/60">{city}</strong>. May not be showing there yet.
                            </p>
                            <a
                              href={fandangoUrl(movie.title, city)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20"
                            >
                              Try Fandango →
                            </a>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {result.showtimes.slice(0, 3).map((day, di) => (
                              <div key={di}>
                                {day.day && (
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/25">{day.day}</p>
                                )}
                                <div className="space-y-4">
                                  {(day.theaters ?? []).map((theater, ti) => {
                                    const showing = theater.showtimes ?? [];
                                    const allTimes = showing.flatMap((s) => s.time ?? []);
                                    if (allTimes.length === 0) return null;
                                    return (
                                      <div key={ti} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                                        <div className="mb-2.5 flex items-start justify-between gap-3">
                                          <div>
                                            <p className="font-medium text-white/90 text-sm leading-snug">{theater.name}</p>
                                            {theater.address && <p className="text-xs text-white/30 mt-0.5">{theater.address}</p>}
                                            {theater.distance && <p className="text-xs text-white/20">{theater.distance}</p>}
                                          </div>
                                          <a
                                            href={theater.link ?? fandangoUrl(movie.title, city)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black transition hover:bg-amber-400"
                                          >
                                            Tickets
                                          </a>
                                        </div>
                                        {showing.map((s, si) => (
                                          <div key={si} className="mb-2">
                                            {s.type && (
                                              <span className={`mb-1.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${typeCls(s.type)}`}>
                                                {s.type}
                                              </span>
                                            )}
                                            <div className="flex flex-wrap gap-1.5">
                                              {(s.time ?? []).map((t, ti2) => (
                                                <a
                                                  key={ti2}
                                                  href={theater.link ?? fandangoUrl(movie.title, city)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
                                                >
                                                  {t}
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {result.cached && (
                              <p className="text-right text-[11px] text-white/15">Cached · refreshes in 6h</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>
      )}

      {city && !loadingMovies && (
        <p className="text-center text-xs text-white/20">
          Showtimes via Google · click any time to buy tickets · data refreshes every 6 hours
        </p>
      )}
    </div>
  );
}
