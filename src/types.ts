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

// A clean bracket with no byes requires a power-of-two field (2, 4, 8, 16, 32…).
export function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}
