import type { Player, Round } from './types';

const PLAYERS_KEY = 'brawl_players';
const ROUNDS_KEY = 'brawl_rounds';
const ACTIVE_KEY = 'brawl_active';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const loadPlayers = () => load<Player[]>(PLAYERS_KEY, []);
export const savePlayers = (v: Player[]) => localStorage.setItem(PLAYERS_KEY, JSON.stringify(v));

export const loadRounds = () => load<Round[]>(ROUNDS_KEY, []);
export const saveRounds = (v: Round[]) => localStorage.setItem(ROUNDS_KEY, JSON.stringify(v));

export const loadActive = () => load<number>(ACTIVE_KEY, 1);
export const saveActive = (v: number) => localStorage.setItem(ACTIVE_KEY, JSON.stringify(v));
