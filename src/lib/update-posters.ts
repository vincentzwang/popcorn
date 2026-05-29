export async function updateMissingPosters(): Promise<void> {
  const key = process.env.TMDB_API_KEY;
  if (!key || key === "your_tmdb_api_key_here") return;

  const getDb = (await import("./db")).default;
  const db = getDb();

  const missing = db
    .prepare("SELECT id, tmdb_id, title FROM movies WHERE poster_path IS NULL OR runtime IS NULL OR genres IS NULL OR streaming IS NULL")
    .all() as Array<{ id: number; tmdb_id: number; title: string }>;

  if (missing.length === 0) return;
  console.log(`[posters] Syncing ${missing.length} movies…`);

  const update = db.prepare(`
    UPDATE movies SET
      poster_path   = COALESCE(poster_path, ?),
      backdrop_path = COALESCE(backdrop_path, ?),
      director      = COALESCE(director, ?),
      overview      = COALESCE(overview, ?),
      runtime       = COALESCE(runtime, ?),
      genres        = COALESCE(genres, ?),
      streaming     = COALESCE(streaming, ?)
    WHERE id = ?
  `);

  for (let i = 0; i < missing.length; i++) {
    const movie = missing[i];
    try {
      const [detailRes, providerRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${key}&append_to_response=credits`, { signal: AbortSignal.timeout(5000) }),
        fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}/watch/providers?api_key=${key}`, { signal: AbortSignal.timeout(5000) }),
      ]);

      if (!detailRes.ok) continue;
      const data = await detailRes.json();
      const director = data.credits?.crew?.find((c: { job: string; name: string }) => c.job === "Director")?.name ?? null;
      const genres = data.genres?.map((g: { name: string }) => g.name).join(",") ?? null;

      // Streaming: US flatrate (subscription) providers only — store as JSON array of {id, name}
      let streaming: string | null = null;
      if (providerRes.ok) {
        const pd = await providerRes.json();
        const flatrate = pd.results?.US?.flatrate ?? [];
        if (flatrate.length > 0) {
          streaming = JSON.stringify(flatrate.map((p: { provider_id: number; provider_name: string }) => ({
            id: p.provider_id,
            name: p.provider_name,
          })));
        } else {
          streaming = "[]"; // explicitly empty so we don't re-fetch
        }
      }

      update.run(data.poster_path ?? null, data.backdrop_path ?? null, director, data.overview ?? null, data.runtime ?? null, genres, streaming, movie.id);
    } catch { /* skip */ }
    if (i > 0 && i % 20 === 0) await new Promise(r => setTimeout(r, 500));
  }
  console.log(`[posters] Sync complete.`);
}
