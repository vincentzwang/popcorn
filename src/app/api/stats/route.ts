import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

const PERSONALITIES: Record<string, { title: string; emoji: string; desc: string }> = {
  "Action":          { title: "Adrenaline Junkie",    emoji: "⚡", desc: "You live for high-octane thrills and explosive set pieces." },
  "Drama":           { title: "Deep Thinker",         emoji: "🎭", desc: "You're drawn to raw emotion and complex human stories." },
  "Comedy":          { title: "Life of the Party",    emoji: "😂", desc: "You believe movies should make you laugh out loud." },
  "Horror":          { title: "Fear Seeker",          emoji: "👻", desc: "The darker and scarier, the better. You love the rush." },
  "Science Fiction": { title: "The Visionary",        emoji: "🚀", desc: "You're fascinated by what humanity could become." },
  "Romance":         { title: "Hopeless Romantic",    emoji: "💘", desc: "You believe in love stories told on the big screen." },
  "Thriller":        { title: "Edge of Your Seat",    emoji: "🎯", desc: "You can't resist a good twist and a racing pulse." },
  "Animation":       { title: "Young at Heart",       emoji: "✨", desc: "You know the best stories aren't just for kids." },
  "Documentary":     { title: "Truth Seeker",         emoji: "🔍", desc: "Reality is stranger than fiction — and you love it." },
  "Crime":           { title: "True Detective",       emoji: "🕵️", desc: "A good crime mystery is your idea of a perfect night." },
  "Adventure":       { title: "Wanderer",             emoji: "🌍", desc: "You love sweeping journeys to unknown worlds." },
  "Fantasy":         { title: "Dreamer",              emoji: "🧙", desc: "Magic and myth are as real as anything to you." },
  "History":         { title: "Time Traveller",       emoji: "⏳", desc: "You're captivated by stories from another era." },
  "War":             { title: "The Strategist",       emoji: "🎖️", desc: "You're drawn to the human stories inside the chaos of conflict." },
  "Music":           { title: "Soundtrack of Life",   emoji: "🎵", desc: "A great film score can make you feel everything at once." },
};

function getPersonality(topGenres: string[]) {
  for (const g of topGenres) {
    if (PERSONALITIES[g]) return PERSONALITIES[g];
  }
  return { title: "The Cinephile", emoji: "🍿", desc: "You watch everything. No genre is off-limits." };
}

// Returns longest consecutive-week streak (at least 1 rating per week)
function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const weekNums = [
    ...new Set(dates.map((d) => Math.floor(new Date(d).getTime() / MS_PER_WEEK))),
  ].sort((a, b) => b - a); // descending
  let streak = 1;
  let max = 1;
  for (let i = 1; i < weekNums.length; i++) {
    if (weekNums[i - 1] - weekNums[i] === 1) { streak++; max = Math.max(max, streak); }
    else streak = 1;
  }
  return max;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetUsername = searchParams.get("username");

  const db = getDb();
  let userId = Number((session.user as { id: string }).id);

  if (targetUsername) {
    const u = db.prepare("SELECT id FROM users WHERE username = ?").get(targetUsername) as { id: number } | undefined;
    if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });
    userId = u.id;
  }

  // ── Core counts ──────────────────────────────────────────────────────────
  const tiers = db
    .prepare("SELECT tier, COUNT(*) as count FROM user_movies WHERE user_id = ? GROUP BY tier")
    .all(userId) as Array<{ tier: string; count: number }>;

  const tierMap = Object.fromEntries(tiers.map((t) => [t.tier, t.count]));
  const totalMovies = tiers.reduce((s, t) => s + t.count, 0);

  const avgScore = (db
    .prepare("SELECT AVG(score) as avg FROM user_movies WHERE user_id = ? AND score IS NOT NULL")
    .get(userId) as { avg: number | null }).avg;

  // ── Screen time ───────────────────────────────────────────────────────────
  const runtimeRow = db
    .prepare(`SELECT SUM(m.runtime) as total FROM user_movies um
              JOIN movies m ON m.id = um.movie_id WHERE um.user_id = ? AND m.runtime IS NOT NULL`)
    .get(userId) as { total: number | null };
  const totalMinutes = runtimeRow.total ?? 0;
  const totalHours = Math.round(totalMinutes / 60);

  // ── Genres ────────────────────────────────────────────────────────────────
  const movieGenres = db
    .prepare(`SELECT m.genres FROM user_movies um
              JOIN movies m ON m.id = um.movie_id
              WHERE um.user_id = ? AND um.tier = 'liked' AND m.genres IS NOT NULL`)
    .all(userId) as Array<{ genres: string }>;

  const genreCount: Record<string, number> = {};
  for (const row of movieGenres) {
    for (const g of row.genres.split(",")) {
      const name = g.trim();
      if (name) genreCount[name] = (genreCount[name] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  // ── Directors ─────────────────────────────────────────────────────────────
  const directorRows = db
    .prepare(`SELECT m.director, COUNT(*) as count FROM user_movies um
              JOIN movies m ON m.id = um.movie_id
              WHERE um.user_id = ? AND m.director IS NOT NULL
              GROUP BY m.director ORDER BY count DESC LIMIT 5`)
    .all(userId) as Array<{ director: string; count: number }>;

  // ── Monthly activity ──────────────────────────────────────────────────────
  const monthly = db
    .prepare(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
              FROM user_movies WHERE user_id = ?
              GROUP BY month ORDER BY month ASC`)
    .all(userId) as Array<{ month: string; count: number }>;

  // ── Streak ────────────────────────────────────────────────────────────────
  const allDates = (db
    .prepare("SELECT created_at FROM user_movies WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Array<{ created_at: string }>).map((r) => r.created_at);
  const streak = calcStreak(allDates);

  // ── First rating + recent milestone ──────────────────────────────────────
  const firstRating = (db
    .prepare("SELECT MIN(created_at) as d FROM user_movies WHERE user_id = ?")
    .get(userId) as { d: string | null }).d;

  // ── Score distribution ────────────────────────────────────────────────────
  const scoreDistrib = db
    .prepare(`SELECT
        SUM(CASE WHEN score >= 7 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN score >= 4 AND score < 7 THEN 1 ELSE 0 END) as mid,
        SUM(CASE WHEN score < 4 THEN 1 ELSE 0 END) as low
      FROM user_movies WHERE user_id = ? AND score IS NOT NULL`)
    .get(userId) as { high: number; mid: number; low: number };

  // ── Watch partners ────────────────────────────────────────────────────────
  const watchPartners = db
    .prepare(`
      SELECT u.username, COUNT(*) as count
      FROM watched_with ww
      JOIN user_movies um ON um.id = ww.user_movie_id
      JOIN users u ON u.id = ww.partner_id
      WHERE um.user_id = ?
      GROUP BY u.id ORDER BY count DESC LIMIT 5
    `)
    .all(userId) as Array<{ username: string; count: number }>;

  const personality = getPersonality(topGenres.map((g) => g.name));

  return NextResponse.json({
    totalMovies,
    totalHours,
    totalMinutes,
    avgScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
    streak,
    tiers: { liked: tierMap.liked ?? 0, fine: tierMap.fine ?? 0, disliked: tierMap.disliked ?? 0 },
    topGenres,
    topDirectors: directorRows,
    monthly,
    scoreDistrib,
    personality,
    watchPartners,
    firstRating,
  });
}
