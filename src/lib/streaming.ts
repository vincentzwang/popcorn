export interface StreamingProvider { id: number; name: string; }

// Provider display config — id → { abbr, bg, text }
const CONFIG: Record<number, { abbr: string; bg: string; text: string }> = {
  8:    { abbr: "N",   bg: "#E50914", text: "#fff" }, // Netflix
  9:    { abbr: "P",   bg: "#00A8E1", text: "#fff" }, // Amazon Prime
  337:  { abbr: "D+",  bg: "#113CCF", text: "#fff" }, // Disney+
  1899: { abbr: "M",   bg: "#6B1FCD", text: "#fff" }, // Max (HBO)
  15:   { abbr: "H",   bg: "#1CE783", text: "#000" }, // Hulu
  2:    { abbr: "A",   bg: "#1c1c1e", text: "#fff" }, // Apple TV+
  386:  { abbr: "Pc",  bg: "#0064FF", text: "#fff" }, // Peacock
  531:  { abbr: "Pv",  bg: "#5433FF", text: "#fff" }, // Paramount+
  283:  { abbr: "Cr",  bg: "#F47521", text: "#fff" }, // Crunchyroll
};

// Priority order for display (show most recognisable first)
const PRIORITY = [8, 337, 1899, 9, 15, 2, 386, 531];

export function parseProviders(raw: string | null): StreamingProvider[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as StreamingProvider[]; } catch { return []; }
}

export function topProviders(providers: StreamingProvider[], max = 3): StreamingProvider[] {
  const sorted = [...providers].sort((a, b) => {
    const ai = PRIORITY.indexOf(a.id);
    const bi = PRIORITY.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted.slice(0, max);
}

export function providerStyle(id: number) {
  return CONFIG[id] ?? { abbr: "?", bg: "#444", text: "#fff" };
}
