import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import getDb from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;
  const session = await getServerSession(authOptions);
  const myId = session?.user ? Number((session.user as { id: string }).id) : null;
  const db = getDb();

  const movie = db
    .prepare("SELECT * FROM movies WHERE tmdb_id = ?")
    .get(Number(tmdbId)) as Record<string, unknown> | undefined;

  if (!movie) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ratings = db
    .prepare(`
      SELECT um.id as um_id, um.tier, um.score, um.review, um.created_at,
             um.position, u.username, u.id as user_id
      FROM user_movies um
      JOIN users u ON u.id = um.user_id
      WHERE um.movie_id = (SELECT id FROM movies WHERE tmdb_id = ?)
      ORDER BY um.score DESC, um.created_at DESC
    `)
    .all(Number(tmdbId));

  type RatingRow = { um_id: number; tier: string; score: number | null; review: string | null; created_at: string; username: string; user_id: number; position: number };
  const rows = ratings as RatingRow[];

  // Summary stats
  const total = rows.length;
  const liked = rows.filter((r) => r.tier === "liked").length;
  const fine  = rows.filter((r) => r.tier === "fine").length;
  const disliked = rows.filter((r) => r.tier === "disliked").length;
  const scores = rows.filter((r) => r.score !== null).map((r) => r.score as number);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const myRating = myId ? rows.find((r) => r.user_id === myId) ?? null : null;

  return NextResponse.json({ movie, ratings, stats: { total, liked, fine, disliked, avgScore }, myRating });
}
