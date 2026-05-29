import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

// ── helpers ──────────────────────────────────────────────────────────────────

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function topGenres(ratings: Array<{ tier: string; genres: string | null }>, minTier = "liked"): Set<string> {
  const tiers = minTier === "liked" ? ["liked"] : ["liked", "fine"];
  const counts: Record<string, number> = {};
  for (const r of ratings) {
    if (!tiers.includes(r.tier) || !r.genres) continue;
    for (const g of r.genres.split(",").map(s => s.trim()).filter(Boolean)) {
      counts[g] = (counts[g] ?? 0) + 1;
    }
  }
  // Return the top-8 genres by count
  return new Set(
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  const intersection = [...a].filter(g => b.has(g)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function tierDistribution(ratings: Array<{ tier: string }>) {
  const n = ratings.length || 1;
  const liked    = ratings.filter(r => r.tier === "liked").length / n;
  const fine     = ratings.filter(r => r.tier === "fine").length / n;
  const disliked = ratings.filter(r => r.tier === "disliked").length / n;
  return { liked, fine, disliked };
}

// Distribution overlap: 1 - half of sum of absolute differences (max diff = 2, so /2 gives 0→1)
function distributionSimilarity(
  a: ReturnType<typeof tierDistribution>,
  b: ReturnType<typeof tierDistribution>
): number {
  const diff = Math.abs(a.liked - b.liked) + Math.abs(a.fine - b.fine) + Math.abs(a.disliked - b.disliked);
  return Math.max(0, 1 - diff / 2);
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId = Number((session.user as { id: string }).id);
  const db = getDb();

  const other = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
  if (!other) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (myId === other.id) return NextResponse.json({ score: 100, factors: {}, shared: 0 });

  type RatingRow = {
    movie_id: number; tier: string; score: number | null;
    title: string; poster_path: string | null;
    release_year: number | null; tmdb_id: number;
    genres: string | null; director: string | null;
  };

  const fetchRatings = (userId: number) =>
    db.prepare(`
      SELECT um.movie_id, um.tier, um.score,
             m.title, m.poster_path, m.release_year, m.tmdb_id,
             m.genres, m.director
      FROM user_movies um JOIN movies m ON m.id = um.movie_id
      WHERE um.user_id = ?
    `).all(userId) as RatingRow[];

  const myRatings    = fetchRatings(myId);
  const theirRatings = fetchRatings(other.id);

  const myMap    = new Map(myRatings.map(r => [r.movie_id, r]));
  const theirMap = new Map(theirRatings.map(r => [r.movie_id, r]));

  const sharedIds = [...myMap.keys()].filter(id => theirMap.has(id));

  if (sharedIds.length === 0) {
    return NextResponse.json({
      score: null, factors: {}, shared: 0,
      both: [], conflicts: [], onlyThem: theirRatings.slice(0, 12), onlyMe: myRatings.slice(0, 12),
      myAvgScore: avg(myRatings.filter(r => r.score !== null).map(r => r.score!)),
      theirAvgScore: avg(theirRatings.filter(r => r.score !== null).map(r => r.score!)),
      sharedGenres: [],
    });
  }

  // ── Factor 1: Score similarity (50%) ─────────────────────────────────────
  const scoredPairs = sharedIds.flatMap(id => {
    const m = myMap.get(id)!;
    const t = theirMap.get(id)!;
    return (m.score !== null && t.score !== null) ? [{ m: m.score, t: t.score }] : [];
  });

  let scoreSim: number;
  if (scoredPairs.length >= 2) {
    const meanAbsDiff = scoredPairs.reduce((sum, p) => sum + Math.abs(p.m - p.t), 0) / scoredPairs.length;
    scoreSim = Math.round((1 - meanAbsDiff / 9) * 100);
  } else {
    // Fall back to tier distances when scores are unavailable
    const TIER_NUM: Record<string, number> = { liked: 9, fine: 5, disliked: 1 };
    const meanTierDiff = sharedIds.reduce((sum, id) => {
      const d = Math.abs(TIER_NUM[myMap.get(id)!.tier] - TIER_NUM[theirMap.get(id)!.tier]);
      return sum + d;
    }, 0) / sharedIds.length;
    scoreSim = Math.round((1 - meanTierDiff / 8) * 100);
  }

  // ── Factor 2: Genre taste overlap (25%) ──────────────────────────────────
  const myGenres    = topGenres(myRatings);
  const theirGenres = topGenres(theirRatings);
  const genreSim    = Math.round(jaccardSimilarity(myGenres, theirGenres) * 100);
  const sharedGenres = [...myGenres].filter(g => theirGenres.has(g));

  // ── Factor 3: Critical style — are you both harsh/generous? (15%) ─────────
  const myScores    = myRatings.filter(r => r.score !== null).map(r => r.score!);
  const theirScores = theirRatings.filter(r => r.score !== null).map(r => r.score!);
  const myAvgScore    = avg(myScores);
  const theirAvgScore = avg(theirScores);
  const styleSim = (myAvgScore !== null && theirAvgScore !== null)
    ? Math.round((1 - Math.abs(myAvgScore - theirAvgScore) / 9) * 100)
    : 60; // neutral default

  // ── Factor 4: Tier distribution similarity (10%) ──────────────────────────
  const myDist    = tierDistribution(myRatings);
  const theirDist = tierDistribution(theirRatings);
  const distSim   = Math.round(distributionSimilarity(myDist, theirDist) * 100);

  // ── Weighted combination ──────────────────────────────────────────────────
  const rawScore = scoreSim * 0.50 + genreSim * 0.25 + styleSim * 0.15 + distSim * 0.10;

  // Confidence adjustment: fewer shared movies → regression toward 50
  const confidence = Math.min(1, sharedIds.length / 15);
  const finalScore = Math.round(rawScore * confidence + 50 * (1 - confidence));

  // ── Agreement / disagreement breakdown ────────────────────────────────────
  const TIER_SCORE: Record<string, number> = { liked: 2, fine: 1, disliked: 0 };

  const bothLoved: RatingRow[] = [];
  const conflicts: Array<{ movie: RatingRow; myTier: string; theirTier: string; scoreDiff: number | null }> = [];

  for (const id of sharedIds) {
    const mine   = myMap.get(id)!;
    const theirs = theirMap.get(id)!;
    const tierDist = Math.abs(TIER_SCORE[mine.tier] - TIER_SCORE[theirs.tier]);

    if (tierDist === 0) {
      bothLoved.push(mine);
    } else if (tierDist === 2) {
      const scoreDiff = (mine.score !== null && theirs.score !== null)
        ? Math.abs(mine.score - theirs.score) : null;
      conflicts.push({ movie: mine, myTier: mine.tier, theirTier: theirs.tier, scoreDiff });
    }
  }

  // Sort conflicts by score difference (biggest disagreements first)
  conflicts.sort((a, b) => (b.scoreDiff ?? 8) - (a.scoreDiff ?? 0));

  const onlyThem = theirRatings.filter(r => !myMap.has(r.movie_id));
  const onlyMe   = myRatings.filter(r => !theirMap.has(r.movie_id));

  // Movies explicitly watched together (either tagged the other)
  const watchedTogetherCount = (db.prepare(`
    SELECT COUNT(*) as n FROM (
      SELECT ww.user_movie_id FROM watched_with ww
      JOIN user_movies um ON um.id = ww.user_movie_id
      WHERE um.user_id = ? AND ww.partner_id = ?
      UNION
      SELECT ww.user_movie_id FROM watched_with ww
      JOIN user_movies um ON um.id = ww.user_movie_id
      WHERE um.user_id = ? AND ww.partner_id = ?
    )
  `).get(myId, other.id, other.id, myId) as { n: number }).n;

  // Most impactful genre overlap context
  const myTopGenreList    = [...myGenres].slice(0, 5);
  const theirTopGenreList = [...theirGenres].slice(0, 5);

  return NextResponse.json({
    score: finalScore,
    shared: sharedIds.length,
    confidence: sharedIds.length >= 15 ? "high" : sharedIds.length >= 5 ? "medium" : "low",

    factors: {
      scores:  { value: scoreSim,  label: "Score alignment",   desc: scoredPairs.length >= 2 ? `Avg difference: ${(scoredPairs.reduce((s, p) => s + Math.abs(p.m - p.t), 0) / scoredPairs.length).toFixed(1)} points` : "Based on tier comparison" },
      genres:  { value: genreSim,  label: "Genre taste",       desc: sharedGenres.length > 0 ? `Both love: ${sharedGenres.slice(0, 3).join(", ")}` : "Different genre preferences" },
      style:   { value: styleSim,  label: "Critical style",    desc: (myAvgScore && theirAvgScore) ? `You avg ${myAvgScore.toFixed(1)} · They avg ${theirAvgScore.toFixed(1)}` : "Not enough scored movies" },
      patterns:{ value: distSim,   label: "Rating patterns",   desc: `${Math.round(myDist.liked * 100)}% liked vs ${Math.round(theirDist.liked * 100)}% liked` },
    },

    both:     bothLoved.slice(0, 12),
    conflicts: conflicts.slice(0, 6),
    onlyThem: onlyThem.slice(0, 12),
    onlyMe:   onlyMe.slice(0, 12),

    watchedTogether: watchedTogetherCount,
    myAvgScore,
    theirAvgScore,
    myTopGenres:    myTopGenreList,
    theirTopGenres: theirTopGenreList,
    sharedGenres:   sharedGenres.slice(0, 4),
  });
}
