export type Player = {
  id: string;
  name: string;
  isSub: boolean;
};

export type Matchup = {
  id: string;
  aId: string | null;
  bId: string | null;   // null = play-in winner slot (not yet filled)
  winnerId: string | null;
};

export type Round = {
  number: number;        // 0 = play-in, 1+ = main bracket rounds
  map: string | null;
  matchups: Matchup[];
  isPlayIn?: boolean;
};

export const MAPS = [
  'No Surrender',
  "Warrior's Way",
  'Monkey Maze',
  'Jumpscare Lair',
  'Coin Flip',
] as const;

// Largest power of 2 <= n (min 2). e.g. 12 → 8.
export function prevPow2(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return Math.max(p, 2);
}

// Smallest power of 2 >= n (min 2). e.g. 12 → 16.
export function nextPow2(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export function isPow2(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}
