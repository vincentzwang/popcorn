import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";
import { recalculateScores, Tier } from "@/lib/scoring";

interface CompareRequest {
  umId: number;       // the new movie being inserted
  winnerId: number;   // whichever um_id the user said they preferred
  loserId: number;
  low: number;        // current search bounds
  high: number;
  tier: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number((session.user as { id: string }).id);
  const { umId, winnerId, loserId, low, high, tier }: CompareRequest = await req.json();

  const db = getDb();

  // Record the comparison
  db.prepare(
    "INSERT INTO comparisons (user_id, winner_um_id, loser_um_id) VALUES (?,?,?)"
  ).run(userId, winnerId, loserId);

  // Get current sorted list for this tier
  const tierMovies = db
    .prepare(
      "SELECT id FROM user_movies WHERE user_id = ? AND tier = ? ORDER BY position ASC"
    )
    .all(userId, tier) as Array<{ id: number }>;

  // Exclude the new movie from the existing sorted list
  const existingList = tierMovies.filter((m) => m.id !== umId);

  // Binary search: update bounds based on comparison result
  // If the new movie (umId) won → it should be placed above the compared movie
  // If the new movie (umId) lost → it should be placed below the compared movie
  const midIndex = Math.floor((low + high) / 2);
  const newMovieWon = winnerId === umId;

  let newLow = low;
  let newHigh = high;

  if (newMovieWon) {
    // New movie is better; search upper half
    newHigh = midIndex - 1;
  } else {
    // New movie is worse; search lower half
    newLow = midIndex + 1;
  }

  // If bounds crossed, we've found the insertion point
  if (newLow > newHigh) {
    // Insert at newLow position in existingList
    const insertAt = newMovieWon ? midIndex : midIndex + 1;
    const clampedInsert = Math.max(0, Math.min(insertAt, existingList.length));

    const newOrder = [
      ...existingList.slice(0, clampedInsert).map((m) => m.id),
      umId,
      ...existingList.slice(clampedInsert).map((m) => m.id),
    ];

    const scores = recalculateScores(tier as Tier, newOrder);
    const update = db.prepare("UPDATE user_movies SET score = ?, position = ? WHERE id = ?");
    for (const s of scores) update.run(s.score, s.position, s.id);

    return NextResponse.json({ done: true });
  }

  // Need another comparison — pick new midpoint
  const nextMid = Math.floor((newLow + newHigh) / 2);
  const nextCompareId = existingList[nextMid]?.id;

  if (!nextCompareId) {
    // Edge case: finish
    const newOrder = newMovieWon
      ? [umId, ...existingList.map((m) => m.id)]
      : [...existingList.map((m) => m.id), umId];
    const scores = recalculateScores(tier as Tier, newOrder);
    const update = db.prepare("UPDATE user_movies SET score = ?, position = ? WHERE id = ?");
    for (const s of scores) update.run(s.score, s.position, s.id);
    return NextResponse.json({ done: true });
  }

  return NextResponse.json({
    done: false,
    compareWith: nextCompareId,
    low: newLow,
    high: newHigh,
  });
}
