import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";
import OpenAI from "openai";

const CACHE_MINUTES = 60;
const MIN_RATINGS = 3;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as { id: string }).id);
  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  const db = getDb();

  // Get user's ratings
  const ratings = db
    .prepare(
      `SELECT um.tier, um.position, m.title, m.release_year
       FROM user_movies um JOIN movies m ON m.id = um.movie_id
       WHERE um.user_id = ? ORDER BY um.tier, um.position`
    )
    .all(userId) as Array<{ tier: string; position: number; title: string; release_year: number | null }>;

  if (ratings.length < MIN_RATINGS) {
    return NextResponse.json({ recommendations: [], tip: `Rate at least ${MIN_RATINGS} movies to unlock personalized recommendations.` });
  }

  // Check cache
  const cached = db
    .prepare("SELECT tmdb_ids, created_at, rating_count, reasoning FROM ai_recommendations WHERE user_id = ?")
    .get(userId) as { tmdb_ids: string; created_at: string; rating_count: number; reasoning: string | null } | undefined;

  const cacheAgeMin = cached
    ? (Date.now() - new Date(cached.created_at + " UTC").getTime()) / 60000
    : Infinity;

  if (!forceRefresh && cached && cacheAgeMin < CACHE_MINUTES && cached.rating_count === ratings.length) {
    const ids: number[] = JSON.parse(cached.tmdb_ids);
    const reasoningMap: Record<number, string> = cached.reasoning ? JSON.parse(cached.reasoning) : {};
    const movies = (ids.length > 0 ? db.prepare(
      `SELECT tmdb_id, title, poster_path, release_year, director, overview
       FROM movies WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`
    ).all(...ids) : []) as Array<Record<string, unknown>>;
    return NextResponse.json({
      recommendations: movies.map(m => ({ ...m, because: reasoningMap[m.tmdb_id as number] ?? null })),
      cached: true,
    });
  }

  // Build taste profile
  const liked = ratings.filter((r) => r.tier === "liked").map((r) => `${r.title}${r.release_year ? ` (${r.release_year})` : ""}`);
  const fine = ratings.filter((r) => r.tier === "fine").map((r) => `${r.title}${r.release_year ? ` (${r.release_year})` : ""}`);
  const disliked = ratings.filter((r) => r.tier === "disliked").map((r) => `${r.title}${r.release_year ? ` (${r.release_year})` : ""}`);
  const alreadySeen = ratings.map((r) => r.title.toLowerCase());

  const lines = [
    liked.length > 0 && `Loved: ${liked.slice(0, 20).join(", ")}`,
    fine.length > 0 && `Thought were okay: ${fine.slice(0, 10).join(", ")}`,
    disliked.length > 0 && `Disliked: ${disliked.slice(0, 10).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a film recommendation engine. Analyze this user's taste and recommend exactly 8 movies they would love.

${lines}

Rules:
- NEVER recommend any of the movies listed above
- Recommend well-known, real films only
- Prioritize variety in genre/era while matching the overall sensibility
- Return ONLY valid JSON — an object with a "recommendations" array
- For each recommendation include a short "because" (max 8 words) explaining why based on their taste

JSON format:
{"recommendations": [{"title": "Movie Title", "year": 2019, "because": "You loved Inception's complex narrative"}, ...]}`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE,
    });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 600,
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { recommendations?: Array<{ title: string; year: number; because?: string }> };
    const suggestions = parsed.recommendations ?? [];

    // Resolve each suggestion to a movie in our DB or TMDB
    const key = process.env.TMDB_API_KEY;
    const resolvedIds: number[] = [];
    const becauseMap: Record<number, string> = {};

    for (const s of suggestions) {
      if (alreadySeen.includes(s.title.toLowerCase())) continue;

      // Check local DB first
      const local = db
        .prepare("SELECT tmdb_id FROM movies WHERE LOWER(title) = LOWER(?) LIMIT 1")
        .get(s.title) as { tmdb_id: number } | undefined;

      if (local) {
        resolvedIds.push(local.tmdb_id);
        if (s.because) becauseMap[local.tmdb_id] = s.because;
        continue;
      }

      // Search TMDB
      if (key && key !== "your_tmdb_api_key_here") {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(s.title)}&year=${s.year}&language=en-US`,
            { signal: AbortSignal.timeout(4000) }
          );
          if (res.ok) {
            const data = await res.json();
            const hit = data.results?.[0];
            if (hit) {
              const year = hit.release_date ? parseInt(hit.release_date.slice(0, 4)) : null;
              db.prepare(
                "INSERT OR IGNORE INTO movies (tmdb_id, title, poster_path, backdrop_path, release_year, overview) VALUES (?,?,?,?,?,?)"
              ).run(hit.id, hit.title, hit.poster_path, hit.backdrop_path, year, hit.overview);
              resolvedIds.push(hit.id);
              if (s.because) becauseMap[hit.id] = s.because;
            }
          }
        } catch { /* skip */ }
      }
    }

    // Persist cache (with reasoning)
    const tmdbIdsJson = JSON.stringify(resolvedIds);
    const reasoningJson = JSON.stringify(becauseMap);
    db.prepare(
      `INSERT INTO ai_recommendations (user_id, tmdb_ids, rating_count, reasoning)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET tmdb_ids=excluded.tmdb_ids, rating_count=excluded.rating_count, reasoning=excluded.reasoning, created_at=CURRENT_TIMESTAMP`
    ).run(userId, tmdbIdsJson, ratings.length, reasoningJson);

    // Fetch full movie data
    const movies =
      resolvedIds.length > 0
        ? db
            .prepare(
              `SELECT tmdb_id, title, poster_path, release_year, director, overview
               FROM movies WHERE tmdb_id IN (${resolvedIds.map(() => "?").join(",")})`
            )
            .all(...resolvedIds)
        : [];

    // Attach "because" labels
    const moviesWithReason = (movies as Array<Record<string, unknown>>).map(m => ({
      ...m,
      because: becauseMap[m.tmdb_id as number] ?? null,
    }));

    return NextResponse.json({ recommendations: moviesWithReason, cached: false });
  } catch (err) {
    console.error("[recommendations]", err);
    return NextResponse.json({ recommendations: [], error: "AI unavailable" });
  }
}
