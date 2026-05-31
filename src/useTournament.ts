import { useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import type { Player, Round } from './types';
import { isPow2, prevPow2 } from './types';
import { loadPlayers, savePlayers, loadRounds, saveRounds, loadActive, saveActive } from './store';
import { supabase, online, TABLE, ROW_ID } from './supabase';

type TState = { players: Player[]; rounds: Round[]; activeRound: number };

function normalize(d: unknown): TState {
  const o = (d ?? {}) as Partial<TState>;
  return {
    players: Array.isArray(o.players) ? o.players : [],
    rounds: Array.isArray(o.rounds) ? o.rounds : [],
    activeRound: typeof o.activeRound === 'number' ? o.activeRound : 1,
  };
}

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
 */
function syncBracket(rounds: Round[]): Round[] {
  const rs = rounds.map(r => ({ ...r, matchups: r.matchups.map(m => ({ ...m })) }));
  const playInIdx = rs.findIndex(r => r.isPlayIn);
  const mainStart = playInIdx >= 0 ? playInIdx + 1 : 0;

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
  const [state, setState] = useState<TState>(() => online ? { players: [], rounds: [], activeRound: 1 } : loadLocal());
  const [loading, setLoading] = useState(online);

  // Load from Supabase + subscribe to realtime changes
  useEffect(() => {
    if (!online || !supabase) return;
    const sb = supabase;
    let active = true;
    const finish = () => { if (active) setLoading(false); };

    sb.from(TABLE).select('data').eq('id', ROW_ID).maybeSingle().then(
      ({ data }) => { if (active && data?.data) setState(normalize(data.data)); finish(); },
      finish,
    );

    const ch = sb
      .channel('tournament')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
        payload => {
          const next = (payload.new as { data?: unknown })?.data;
          if (next) setState(normalize(next));
        })
      .subscribe();

    return () => { active = false; sb.removeChannel(ch); };
  }, []);

  const commit = useCallback((next: TState) => {
    setState(next);
    if (online && supabase) {
      supabase.from(TABLE).upsert({ id: ROW_ID, data: next, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error('Sync failed:', error.message); });
    } else {
      saveLocal(next);
    }
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
    const P = isPow2(N) ? N : prevPow2(N);
    const extra = N - P;
    const playInCount = extra * 2;

    const ids = players.map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const playInIds = ids.slice(0, playInCount);
    const directIds = ids.slice(playInCount);

    const rs: Round[] = [];

    if (extra > 0) {
      const piMatchups = [];
      for (let i = 0; i < playInCount; i += 2) {
        piMatchups.push({ id: uuid(), aId: playInIds[i], bId: playInIds[i + 1], winnerId: null });
      }
      rs.push({ number: 0, map: null, matchups: piMatchups, isPlayIn: true });
    }

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
    if (rounds[0].matchups.some(m => m.winnerId)) return;
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
    players, rounds, activeRound, started, canStart, championId, currentRound, isFinals, loading, online,
    addPlayer, removePlayer, seedBracket, reseed, setMap, resolveMatchup, beginNextRound, resetAll,
  };
}
