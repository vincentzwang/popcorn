const BASE = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY;

export interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  overview: string;
}

export interface TmdbCredits {
  crew: Array<{ job: string; name: string }>;
}

export function posterUrl(path: string | null, size = "w342"): string {
  if (!path) return `https://placehold.co/342x513/1a1a1e/555555?text=No+Poster`;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function backdropUrl(path: string | null, size = "w780"): string {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export async function searchMovies(query: string): Promise<TmdbMovie[]> {
  if (!KEY || KEY === "your_tmdb_api_key_here") return [];
  const res = await fetch(
    `${BASE}/search/movie?api_key=${KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results as TmdbMovie[];
}

export async function getMovie(tmdbId: number): Promise<TmdbMovie | null> {
  if (!KEY || KEY === "your_tmdb_api_key_here") return null;
  const res = await fetch(
    `${BASE}/movie/${tmdbId}?api_key=${KEY}&language=en-US`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function getMovieCredits(tmdbId: number): Promise<string | null> {
  if (!KEY || KEY === "your_tmdb_api_key_here") return null;
  const res = await fetch(
    `${BASE}/movie/${tmdbId}/credits?api_key=${KEY}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  const data: TmdbCredits = await res.json();
  const director = data.crew.find((c) => c.job === "Director");
  return director?.name ?? null;
}
