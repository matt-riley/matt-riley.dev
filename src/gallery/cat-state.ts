export interface CatVisit {
  random: number;
  last: Record<string, string>;
  current?: string;
}

export function chooseCatSpot(
  visit: CatVisit,
  stop: number,
  spots: readonly string[],
) {
  if (!spots.length) throw new Error(`No cat spot for stop ${stop}`);
  // A deterministic xorshift sequence survives reloads within this session.
  let state = visit.random || 1;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  visit.random = state >>> 0;
  const candidates = spots.filter((spot) => spot !== visit.last[stop]);
  const choices = candidates.length ? candidates : spots;
  const spot = choices[visit.random % choices.length];
  visit.last[stop] = spot;
  visit.current = spot;
  return spot;
}
