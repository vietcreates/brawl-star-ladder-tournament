import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { Player, Round } from './types';
import { isPow2, prevPow2 } from './types';
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

/**
 * Sync winners upward through the bracket.
 * - Play-in winners flow into the bId slots of the last `extra` Round 1 matchups.
 * - Round 1+ winners flow into upper rounds normally.
 */
function syncBracket(rounds: Round[]): Round[] {
  const rs = rounds.map(r => ({ ...r, matchups: r.matchups.map(m => ({ ...m })) }));
  const playInIdx = rs.findIndex(r => r.isPlayIn);
  const mainStart = playInIdx >= 0 ? playInIdx + 1 : 0;

  // Play-in → Round 1 bId slots (last `extra` matchups of Round 1)
  if (playInIdx >= 0 && mainStart < rs.length) {
    const pi = rs[playInIdx];
    const r1 = rs[mainStart];
    const extra = pi.matchups.length;
    pi.matchups.forEach((m, k) => {
      const r1Idx = r1.matchups.length - extra + k;
      r1.matchups[r1Idx].bId = m.winnerId;
      if (r1.matchups[r1Idx].winnerId &&
          r1.matchups[r1Idx].winnerId !== r1.matchups[r1Idx].aId &&
          r1.matchups[r1Idx].winnerId !== m.winnerId) {
        r1.matchups[r1Idx].winnerId = null;
      }
    });
  }

  // Round 1 → Round 2 → … (standard sync)
  for (let r = mainStart + 1; r < rs.length; r++) {
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
  const canStart = players.length >= 2;
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
    if (N < 2) return null;
    const P = isPow2(N) ? N : prevPow2(N);  // main bracket size
    const extra = N - P;                     // play-in winners needed
    const playInCount = extra * 2;           // players in play-in

    // Shuffle all player IDs
    const ids = players.map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const playInIds = ids.slice(0, playInCount);
    const directIds = ids.slice(playInCount);   // length = directCount

    const rs: Round[] = [];

    // Play-in round (only if there are extra players)
    if (extra > 0) {
      const piMatchups = [];
      for (let i = 0; i < playInCount; i += 2) {
        piMatchups.push({ id: uuid(), aId: playInIds[i], bId: playInIds[i + 1], winnerId: null });
      }
      rs.push({ number: 0, map: null, matchups: piMatchups, isPlayIn: true });
    }

    // Round 1:  (P/2 matchups)
    //   First (P/2 - extra) matchups: two direct players each
    //   Last  `extra` matchups:       one direct player (aId) + play-in winner (bId, null for now)
    const r1Matchups = [];
    let dIdx = 0;
    const fullDirect = P / 2 - extra;
    for (let i = 0; i < fullDirect; i++) {
      r1Matchups.push({ id: uuid(), aId: directIds[dIdx++], bId: directIds[dIdx++], winnerId: null });
    }
    for (let i = 0; i < extra; i++) {
      r1Matchups.push({ id: uuid(), aId: directIds[dIdx++], bId: null, winnerId: null });
    }
    rs.push({ number: 1, map: null, matchups: r1Matchups });

    // Rounds 2 … Finals (all TBD)
    const R = Math.log2(P);
    let count = P / 2;
    for (let r = 2; r <= R; r++) {
      count /= 2;
      rs.push({
        number: r, map: null,
        matchups: Array.from({ length: count }, () => ({ id: uuid(), aId: null, bId: null, winnerId: null })),
      });
    }

    return { players, rounds: syncBracket(rs), activeRound: 1 };
  }, [players]);

  const seedBracket = useCallback(() => {
    const next = buildSeed();
    if (next) commit(next);
  }, [buildSeed, commit]);

  const reseed = useCallback(() => {
    if (rounds.length === 0) return;
    if (rounds[0].matchups.some(m => m.winnerId)) return; // results already recorded
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
