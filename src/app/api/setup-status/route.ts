import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.TMDB_API_KEY;
  return NextResponse.json({
    hasTmdbKey: Boolean(key && key !== "your_tmdb_api_key_here"),
  });
}
