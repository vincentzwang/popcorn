import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId = Number((session.user as { id: string }).id);
  const { searchParams } = new URL(req.url);
  const friendUsername = searchParams.get("friend") ?? "";

  const db = getDb();

  const friend = db.prepare("SELECT id FROM users WHERE username = ?").get(friendUsername) as { id: number } | undefined;
  if (!friend) return NextResponse.json({ error: "Friend not found" }, { status: 404 });

  // Genres each user loves (from liked movies)
  const getTopGenres = (userId: number): string[] => {
    const rows = db.prepare(`
      SELECT m.genres FROM user_movies um
      JOIN movies m ON m.id = um.movie_id
      WHERE um.user_id = ? AND um.tier = 'liked' AND m.genres IS NOT NULL
    `).all(userId) as { genres: string }[];
    const counts: Record<string, number> = {};
    for (const { genres } of rows) {
      for (const g of genres.split(",").map(s => s.trim())) {
        counts[g] = (counts[g] ?? 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
  };

  const myGenres = getTopGenres(myId);
  const theirGenres = getTopGenres(friend.id);
  const sharedGenres = myGenres.filter(g => theirGenres.includes(g));

  // Movies rated by either user (exclude from suggestions)
  const ratedIds = new Set(
    (db.prepare(`
      SELECT movie_id FROM user_movies WHERE user_id IN (?,?)
    `).all(myId, friend.id) as { movie_id: number }[]).map(r => r.movie_id)
  );

  // Find movies matching overlapping genres neither has seen
  const genreFilter = sharedGenres.length > 0 ? sharedGenres : [...new Set([...myGenres, ...theirGenres])];

  if (genreFilter.length === 0) {
    // No genre data — return top-rated unrated movies
    const suggestions = db.prepare(`
      SELECT m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.genres,
             COUNT(um.id) as rating_count, AVG(um.score) as avg_score
      FROM movies m LEFT JOIN user_movies um ON um.movie_id = m.id
      WHERE m.id NOT IN (${ratedIds.size > 0 ? [...ratedIds].map(() => "?").join(",") : "0"})
      GROUP BY m.id HAVING rating_count > 0
      ORDER BY avg_score DESC LIMIT 10
    `).all(...(ratedIds.size > 0 ? [...ratedIds] : []));
    return NextResponse.json({ suggestions, sharedGenres: [], myGenres, theirGenres });
  }

  // Build LIKE clauses for each genre
  const gClauses = genreFilter.map(() => "m.genres LIKE ?").join(" OR ");
  const gParams = genreFilter.map(g => `%${g}%`);
  const excludeClause = ratedIds.size > 0
    ? `AND m.id NOT IN (${[...ratedIds].map(() => "?").join(",")})` : "";
  const excludeParams = ratedIds.size > 0 ? [...ratedIds] : [];

  const suggestions = db.prepare(`
    SELECT m.tmdb_id, m.title, m.poster_path, m.release_year, m.director, m.genres,
           COUNT(um.id) as rating_count, AVG(um.score) as avg_score
    FROM movies m LEFT JOIN user_movies um ON um.movie_id = m.id
    WHERE (${gClauses}) ${excludeClause}
    GROUP BY m.id
    ORDER BY avg_score DESC, rating_count DESC, m.release_year DESC
    LIMIT 12
  `).all(...gParams, ...excludeParams);

  return NextResponse.json({ suggestions, sharedGenres, myGenres, theirGenres });
}
