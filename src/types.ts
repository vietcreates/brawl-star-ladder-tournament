export type Player = {
  id: string;
  name: string;
  isSub: boolean;
};

export type Matchup = {
  id: string;
  aId: string | null;
  bId: string | null;
  winnerId: string | null;
};

export type Round = {
  number: number;        // 1 = first round (most matchups, bottom of the pyramid)
  map: string | null;
  matchups: Matchup[];   // positionally fixed; winner of matchup k feeds matchup floor(k/2) above
};

export const MAPS = [
  'No Surrender',
  "Warrior's Way",
  'Monkey Maze',
  'Jumpscare Lair',
  'Coin Flip',
] as const;

// Returns the smallest power of 2 that is >= n (minimum 2).
export function nextPow2(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}
