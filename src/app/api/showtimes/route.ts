import { NextResponse } from "next/server";
import getDb from "@/lib/db";

const CACHE_HOURS = 6;

export interface Showing {
  type?: string;
  time?: string[];
}
export interface Theater {
  name: string;
  link?: string;
  address?: string;
  distance?: string;
  showing?: Showing[];   // SerpAPI key for this structure
  showtimes?: Showing[]; // fallback alias
}
export interface ShowtimeDay {
  day: string | null;
  theaters?: Theater[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const movie = searchParams.get("movie") ?? "";
  const city  = searchParams.get("city") ?? "";   // e.g. "New York"

  if (!movie || !city) {
    return NextResponse.json({ error: "movie and city required" }, { status: 400 });
  }

  const key = process.env.SERPAPI_KEY;
  if (!key) return NextResponse.json({ error: "SERPAPI_KEY not set" }, { status: 500 });

  const db = getDb();

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `${movie.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${city.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${today}`;

  // Cache hit?
  const cached = db.prepare("SELECT data, created_at FROM showtime_cache WHERE cache_key = ?").get(cacheKey) as
    | { data: string; created_at: string } | undefined;

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.created_at + " UTC").getTime()) / 3600000;
    if (ageHours < CACHE_HOURS) {
      return NextResponse.json({ ...JSON.parse(cached.data), cached: true });
    }
  }

  // Query format that SerpAPI / Google parses best for showtimes
  const query = `${movie} showtimes near ${city}`;

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    hl: "en",
    gl: "us",
    api_key: key,
  });

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ showtimes: [], error: `SerpAPI ${res.status}` });
    }

    const data = await res.json();

    // Normalise: SerpAPI uses "showing" per theater; rename to "showtimes" for consistency
    const rawDays: ShowtimeDay[] = data.showtimes ?? [];
    const showtimes = rawDays.map((day) => ({
      ...day,
      theaters: (day.theaters ?? []).map((t) => ({
        ...t,
        showtimes: t.showing ?? t.showtimes ?? [],
        showing: undefined,
      })),
    }));

    const result = { showtimes, movie, city };

    db.prepare(`
      INSERT INTO showtime_cache (cache_key, data) VALUES (?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, created_at = CURRENT_TIMESTAMP
    `).run(cacheKey, JSON.stringify(result));

    return NextResponse.json({ ...result, cached: false });
  } catch (err) {
    console.error("[showtimes]", err);
    return NextResponse.json({ showtimes: [], error: "Request failed" });
  }
}
