import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { Player, Round } from './types';
import { isPowerOfTwo } from './types';
import { loadPlayers, savePlayers, loadRounds, saveRounds, loadActive, saveActive } from './store';

type TState = { players: Player[]; rounds: Round[]; activeRound: number };

function loadLocal(): TState {
  return { players: loadPlayers(), rounds: loadRounds(), activeRound: loadActive() };
}
function saveLocal(s: TState) {
  savePlayers(s.players);
  saveRounds(s.rounds);
  saveActive(s.activeRound);
}

// Recompute every upper round from the round below, clearing now-invalid winners.
function syncBracket(rounds: Round[]): Round[] {
  const rs = rounds.map(r => ({ ...r, matchups: r.matchups.map(m => ({ ...m })) }));
  for (let r = 1; r < rs.length; r++) {
    const prev = rs[r - 1];
    rs[r].matchups.forEach((m, k) => {
      const a = prev.matchups[2 * k]?.winnerId ?? null;
      const b = prev.matchups[2 * k + 1]?.winnerId ?? null;
      m.aId = a;
      m.bId = b;
      if (m.winnerId && m.winnerId !== a && m.winnerId !== b) m.winnerId = null;
    });
  }
  return rs;
}

export function useTournament() {
  const [state, setState] = useState<TState>(loadLocal);

  const commit = useCallback((next: TState) => {
    setState(next);
    saveLocal(next);
  }, []);

  const { players, rounds, activeRound } = state;
  const started = rounds.length > 0;
  const canStart = isPowerOfTwo(players.length);
  const championId = started ? rounds[rounds.length - 1].matchups[0].winnerId : null;
  const isFinals = started && activeRound === rounds.length;
  const currentRound = (!started || championId) ? null : rounds[activeRound - 1] ?? null;

  const addPlayer = useCallback((name: string, isSub: boolean) => {
    if (started) return;
    commit({ ...state, players: [...players, { id: uuid(), name, isSub }] });
  }, [state, players, started, commit]);

  const removePlayer = useCallback((id: string) => {
    if (started) return;
    commit({ ...state, players: players.filter(p => p.id !== id) });
  }, [state, players, started, commit]);

  const buildSeed = useCallback((): TState | null => {
    const N = players.length;
    if (!isPowerOfTwo(N)) return null;
    const ids = players.map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const R = Math.log2(N);
    const rs: Round[] = [];
    const first = [];
    for (let i = 0; i < N; i += 2) first.push({ id: uuid(), aId: ids[i], bId: ids[i + 1], winnerId: null });
    rs.push({ number: 1, map: null, matchups: first });
    let count = N / 2;
    for (let r = 2; r <= R; r++) {
      count /= 2;
      rs.push({ number: r, map: null, matchups: Array.from({ length: count }, () => ({ id: uuid(), aId: null, bId: null, winnerId: null })) });
    }
    return { players, rounds: rs, activeRound: 1 };
  }, [players]);

  const seedBracket = useCallback(() => {
    const next = buildSeed();
    if (next) commit(next);
  }, [buildSeed, commit]);

  const reseed = useCallback(() => {
    if (rounds.length === 0 || rounds[0].matchups.some(m => m.winnerId)) return;
    const next = buildSeed();
    if (next) commit(next);
  }, [rounds, buildSeed, commit]);

  const setMap = useCallback((roundNumber: number, map: string | null) => {
    commit({ ...state, rounds: rounds.map(r => r.number === roundNumber ? { ...r, map } : r) });
  }, [state, rounds, commit]);

  const resolveMatchup = useCallback((matchupId: string, winnerId: string) => {
    if (!currentRound) return;
    const rs = rounds.map(r => ({ ...r, matchups: r.matchups.map(m => ({ ...m })) }));
    const m = rs[activeRound - 1].matchups.find(x => x.id === matchupId);
    if (!m || !m.aId || !m.bId) return;
    m.winnerId = m.winnerId === winnerId ? null : winnerId;
    commit({ ...state, rounds: syncBracket(rs) });
  }, [state, currentRound, activeRound, rounds, commit]);

  const beginNextRound = useCallback(() => {
    if (!currentRound || !currentRound.matchups.every(m => m.winnerId)) return;
    if (activeRound < rounds.length) commit({ ...state, activeRound: activeRound + 1 });
  }, [state, currentRound, activeRound, rounds, commit]);

  const resetAll = useCallback(() => {
    commit({ players: [], rounds: [], activeRound: 1 });
  }, [commit]);

  return {
    players, rounds, activeRound, started, canStart, championId, currentRound, isFinals,
    addPlayer, removePlayer, seedBracket, reseed, setMap, resolveMatchup, beginNextRound, resetAll,
  };
}
