// Score ranges per tier (inclusive)
const TIER_RANGES = {
  liked: { min: 7.0, max: 10.0 },
  fine: { min: 4.0, max: 6.9 },
  disliked: { min: 1.0, max: 3.9 },
} as const;

export type Tier = keyof typeof TIER_RANGES;

/**
 * Given a list of user_movie ids sorted best→worst within a tier,
 * recalculate scores so they're evenly distributed across the tier's range.
 * Position 0 = best (highest score).
 */
export function recalculateScores(
  tier: Tier,
  sortedIds: number[]
): Array<{ id: number; score: number; position: number }> {
  const { min, max } = TIER_RANGES[tier];
  const n = sortedIds.length;

  return sortedIds.map((id, index) => {
    // n=1 → score is midpoint of range; n>1 → spread evenly
    const score = n === 1 ? (min + max) / 2 : max - (index / (n - 1)) * (max - min);
    return { id, score: Math.round(score * 10) / 10, position: index };
  });
}

export function tierLabel(tier: Tier): string {
  return { liked: "Liked", fine: "Fine", disliked: "Disliked" }[tier];
}

export function tierColor(tier: Tier): string {
  return {
    liked: "text-emerald-400",
    fine: "text-amber-400",
    disliked: "text-red-400",
  }[tier];
}

export function tierBg(tier: Tier): string {
  return {
    liked: "bg-emerald-500/20 border-emerald-500/40",
    fine: "bg-amber-500/20 border-amber-500/40",
    disliked: "bg-red-500/20 border-red-500/40",
  }[tier];
}

export function scoreColor(score: number): string {
  if (score >= 7) return "text-emerald-400";
  if (score >= 4) return "text-amber-400";
  return "text-red-400";
}
