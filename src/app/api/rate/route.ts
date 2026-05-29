import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";
import { getMovie, getMovieCredits } from "@/lib/tmdb";
import { recalculateScores, Tier } from "@/lib/scoring";
import { createNotification } from "@/lib/notify";

// POST /api/rate — create initial user_movie entry (tier selected, no comparisons yet)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as { id: string }).id);
  const myUsername = (session.user as { username?: string }).username ?? "";
  const { tmdbId, tier, review, skipCompare, watchedWith } = await req.json();

  if (!tmdbId || !tier) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = getDb();

  // Guard against stale JWT referencing a deleted/non-existent user
  const userRow = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!userRow) return NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });

  // Upsert movie into local db
  let movie = db.prepare("SELECT id FROM movies WHERE tmdb_id = ?").get(tmdbId) as
    | { id: number }
    | undefined;

  if (!movie) {
    const tmdbMovie = await getMovie(tmdbId);
    if (!tmdbMovie) return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    const director = await getMovieCredits(tmdbId);
    const year = tmdbMovie.release_date ? parseInt(tmdbMovie.release_date.slice(0, 4)) : null;
    const result = db
      .prepare(
        "INSERT INTO movies (tmdb_id, title, poster_path, backdrop_path, release_year, overview, director) VALUES (?,?,?,?,?,?,?)"
      )
      .run(tmdbId, tmdbMovie.title, tmdbMovie.poster_path, tmdbMovie.backdrop_path, year, tmdbMovie.overview, director);
    movie = { id: Number(result.lastInsertRowid) };
  }

  // Check for existing rating
  const existing = db
    .prepare("SELECT id FROM user_movies WHERE user_id = ? AND movie_id = ?")
    .get(userId, movie.id);
  if (existing) {
    return NextResponse.json({ error: "Already rated" }, { status: 409 });
  }

  // Get movies in this tier to determine comparison sequence
  const tierMovies = db
    .prepare(
      "SELECT id FROM user_movies WHERE user_id = ? AND tier = ? ORDER BY position ASC"
    )
    .all(userId, tier) as Array<{ id: number }>;

  // Insert at end temporarily (position = tierMovies.length)
  const insert = db
    .prepare(
      "INSERT INTO user_movies (user_id, movie_id, tier, position, review) VALUES (?,?,?,?,?)"
    )
    .run(userId, movie.id, tier, tierMovies.length, review ?? null);

  const newUmId = Number(insert.lastInsertRowid);

  // Record watch partner if provided
  if (watchedWith && typeof watchedWith === "string") {
    const partner = db.prepare("SELECT id, username FROM users WHERE username = ?").get(watchedWith) as
      { id: number; username: string } | undefined;
    if (partner && partner.id !== userId) {
      db.prepare("INSERT OR REPLACE INTO watched_with (user_movie_id, partner_id) VALUES (?,?)").run(newUmId, partner.id);
      // Get the movie title for the notification
      const movieRow = db.prepare("SELECT title FROM movies WHERE id = ?").get(movie.id) as { title: string } | undefined;
      createNotification(db, {
        userId: partner.id, actorId: userId, actorUsername: myUsername,
        type: "like", // reuse "like" type for now — close enough
        message: `${myUsername} watched ${movieRow?.title ?? "a movie"} with you`,
        link: `/movies/${tmdbId}`,
      });
    }
  }

  // Onboarding / skipCompare mode: assign midpoint score, skip comparisons
  if (skipCompare) {
    const MIDPOINTS: Record<string, number> = { liked: 8.5, fine: 5.5, disliked: 2.5 };
    db.prepare("UPDATE user_movies SET score = ?, position = ? WHERE id = ?")
      .run(MIDPOINTS[tier] ?? 5, tierMovies.length, newUmId);
    return NextResponse.json({ umId: newUmId, done: true });
  }

  // If first movie in tier, just set score and return done
  if (tierMovies.length === 0) {
    const scores = recalculateScores(tier as Tier, [newUmId]);
    db.prepare("UPDATE user_movies SET score = ?, position = ? WHERE id = ?").run(
      scores[0].score,
      scores[0].position,
      newUmId
    );
    return NextResponse.json({
      umId: newUmId,
      done: true,
      compareWith: null,
    });
  }

  // Return the first comparison target (midpoint of existing list)
  const midIndex = Math.floor(tierMovies.length / 2);
  const compareUmId = tierMovies[midIndex].id;

  return NextResponse.json({
    umId: newUmId,
    done: false,
    compareWith: compareUmId,
    low: 0,
    high: tierMovies.length - 1,
  });
}

// PATCH /api/rate — update review on existing rating
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const { umId, review, watchedWith } = await req.json();
  const db = getDb();
  db.prepare("UPDATE user_movies SET review = ? WHERE id = ? AND user_id = ?").run(review, umId, userId);

  // Update watch partner
  if (watchedWith !== undefined) {
    if (!watchedWith) {
      db.prepare("DELETE FROM watched_with WHERE user_movie_id = ?").run(umId);
    } else {
      const partner = db.prepare("SELECT id FROM users WHERE username = ?").get(watchedWith) as { id: number } | undefined;
      if (partner && partner.id !== userId) {
        db.prepare("INSERT OR REPLACE INTO watched_with (user_movie_id, partner_id) VALUES (?,?)").run(umId, partner.id);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/rate — remove a rating
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number((session.user as { id: string }).id);
  const { umId } = await req.json();
  const db = getDb();

  const um = db
    .prepare("SELECT tier, position FROM user_movies WHERE id = ? AND user_id = ?")
    .get(umId, userId) as { tier: string; position: number } | undefined;
  if (!um) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("DELETE FROM user_movies WHERE id = ?").run(umId);

  // Recalculate positions for remaining movies in tier
  const remaining = db
    .prepare(
      "SELECT id FROM user_movies WHERE user_id = ? AND tier = ? ORDER BY position ASC"
    )
    .all(userId, um.tier) as Array<{ id: number }>;

  if (remaining.length > 0) {
    const scores = recalculateScores(um.tier as Tier, remaining.map((r) => r.id));
    const update = db.prepare("UPDATE user_movies SET score = ?, position = ? WHERE id = ?");
    for (const s of scores) update.run(s.score, s.position, s.id);
  }

  return NextResponse.json({ ok: true });
}
