import type { Player, Round, Matchup } from '../types';
import { MAPS, isPow2, prevPow2 } from '../types';

type Props = {
  players: Player[];
  rounds: Round[];
  activeRound: number;
  championId: string | null;
  admin: boolean;
  onSetMap: (roundNumber: number, map: string | null) => void;
};

// Geometry — bigger bracket
const SLOT_W   = 140;
const SLOT_H   = 46;
const INNER_GAP = 10;
const PAD       = 7;
const BOX_W     = 2 * SLOT_W + INNER_GAP + 2 * PAD;
const BOX_H     = SLOT_H + 2 * PAD;
const BOX_GAP   = 40;
const ROW_PITCH = 130;
const GUTTER    = 150;

export default function BracketTree({ players, rounds, activeRound, championId, admin, onSetMap }: Props) {
  const pname = (id: string | null) => id ? (players.find(p => p.id === id)?.name ?? '???') : null;
  const isSubFn = (id: string | null) => !!id && (players.find(p => p.id === id)?.isSub ?? false);

  const playInRound: Round | null = rounds[0]?.isPlayIn ? rounds[0] : null;
  const mainRounds  = playInRound ? rounds.slice(1) : rounds;

  // Main bracket size P (always a power of 2)
  const N = players.length;
  const P = mainRounds.length > 0
    ? mainRounds[0].matchups.length * 2
    : isPow2(N) ? N : prevPow2(Math.max(N, 2));

  if (N < 2) return <p className="empty">Add at least 2 players to draw the bracket.</p>;

  const extra      = N - P;  // number of play-in matches (0 if power of 2)
  const hasPlayIn  = extra > 0;
  const R          = Math.log2(P);

  // How many main Round 1 matchups are fed by play-in (the last `extra` ones)
  const playInFedStart = P / 2 - extra; // index of first play-in-fed R1 matchup

  // ── Geometry ─────────────────────────────────────────────────────────────
  const centers: number[][] = [];
  centers[1] = Array.from({ length: P / 2 }, (_, b) => b * (BOX_W + BOX_GAP) + BOX_W / 2);
  for (let r = 2; r <= R; r++) {
    const cnt = P / 2 ** r;
    centers[r] = Array.from({ length: cnt }, (_, b) => (centers[r-1][2*b] + centers[r-1][2*b+1]) / 2);
  }
  const totalW   = (P / 2) * BOX_W + (P / 2 - 1) * BOX_GAP;
  const champX   = centers[R][0];
  const yRound   = (r: number) => (R - r + 1) * ROW_PITCH + (hasPlayIn ? ROW_PITCH : 0);
  const yChamp   = 0;
  const yPlayIn  = hasPlayIn ? yRound(1) + ROW_PITCH : 0;
  const totalH   = R * ROW_PITCH + BOX_H + (hasPlayIn ? ROW_PITCH : 0);

  // ── Data helpers ──────────────────────────────────────────────────────────
  // Which activeRound value means main round r is active?
  const mainRoundIsActive = (r: number) => activeRound === r + (playInRound ? 1 : 0);
  const playInIsActive    = playInRound !== null && activeRound === 1;

  // Get main bracket cell (matchup) for round r (1-based), index b
  const mainCell = (r: number, b: number): Matchup => {
    const round = mainRounds[r - 1];
    if (round) return round.matchups[b];
    // Pre-start preview: show players in Round 1 if power of 2, else TBD
    if (r === 1 && isPow2(N)) {
      return { id: `p${b}`, aId: players[2*b]?.id ?? null, bId: players[2*b+1]?.id ?? null, winnerId: null };
    }
    return { id: `e${r}-${b}`, aId: null, bId: null, winnerId: null };
  };

  // Play-in cell for index k
  const playInCell = (k: number): Matchup => {
    if (playInRound) return playInRound.matchups[k];
    // Pre-start preview (not yet seeded): TBD
    return { id: `pi${k}`, aId: null, bId: null, winnerId: null };
  };

  // ── SVG connector lines ───────────────────────────────────────────────────
  const lines: { x1: number; y1: number; x2: number; y2: number; green: boolean }[] = [];

  // Main bracket connectors (Round 1 → Finals)
  for (let r = 1; r <= R; r++) {
    const cnt = P / 2 ** r;
    for (let b = 0; b < cnt; b++) {
      const x1 = GUTTER + centers[r][b];
      const y1 = yRound(r);
      const x2 = r < R ? GUTTER + centers[r+1][Math.floor(b/2)] : GUTTER + champX;
      const y2 = r < R ? yRound(r+1) + BOX_H : yChamp + SLOT_H;
      lines.push({ x1, y1, x2, y2, green: !!mainCell(r, b).winnerId });
    }
  }

  // Play-in connectors (play-in boxes → Round 1 bId slot)
  if (hasPlayIn) {
    for (let k = 0; k < extra; k++) {
      const r1Idx = playInFedStart + k;
      const x1 = GUTTER + centers[1][r1Idx];   // same center as R1 box
      const y1 = yPlayIn;
      // Connect to bottom-center of the R1 box (slightly right for bId visual)
      const x2 = GUTTER + centers[1][r1Idx] + SLOT_W / 2 + INNER_GAP / 2;
      const y2 = yRound(1) + BOX_H;
      lines.push({ x1, y1, x2, y2, green: !!playInCell(k).winnerId });
    }
  }

  // ── Slot component ────────────────────────────────────────────────────────
  const Slot = ({ id, isBye, won, lost, champ }: { id: string | null; isBye?: boolean; won?: boolean; lost?: boolean; champ?: boolean }) => {
    if (isBye) return <div className="bslot bye-slot"><span className="bslot-name">TBD</span></div>;
    return (
      <div className={`bslot${id ? ' filled' : ' empty'}${won ? ' won' : ''}${lost ? ' lost' : ''}${champ ? ' champ' : ''}`}>
        {champ && id && <span className="crown">👑</span>}
        <span className="bslot-name">{pname(id) ?? 'TBD'}</span>
        {isSubFn(id) && <span className="sub-badge">SUB</span>}
      </div>
    );
  };

  const roundLabel = (r: number) => r === R ? 'Finals' : r === 1 ? 'Round 1' : `Round ${r}`;

  return (
    <div className="bracket-scroll">
      <div className="bracket-tree" style={{ width: GUTTER + totalW, height: totalH }}>

        {/* SVG connector lines */}
        <svg className="bracket-lines" width={GUTTER + totalW} height={totalH}>
          {lines.map((l, i) => (
            <polyline
              key={i}
              points={`${l.x1},${l.y1} ${l.x1},${(l.y1+l.y2)/2} ${l.x2},${(l.y1+l.y2)/2} ${l.x2},${l.y2}`}
              className={`connector${l.green ? ' green' : ''}`}
            />
          ))}
        </svg>

        {/* Champion slot */}
        <div className="bbox champion-box" style={{ left: GUTTER + champX - SLOT_W/2, top: yChamp, width: SLOT_W, height: SLOT_H }}>
          <Slot id={championId} champ won={!!championId} />
        </div>

        {/* Champion label */}
        <div className="round-side abs" style={{ top: yChamp, height: SLOT_H }}>
          <span className="row-label champ">🏆 Champion</span>
        </div>

        {/* Main bracket rounds */}
        {Array.from({ length: R }, (_, ri) => {
          const r   = ri + 1;
          const cnt = P / 2 ** r;
          const map = mainRounds[r-1]?.map ?? null;
          const isActive = mainRoundIsActive(r);
          return (
            <div key={r}>
              <div className="round-side abs" style={{ top: yRound(r), height: BOX_H }}>
                <span className={`row-label${isActive ? ' active' : ''}`}>{roundLabel(r)}</span>
                {admin && isActive ? (
                  <div className="map-control">
                    <span className="map-label">Map</span>
                    <select className="map-select" value={map ?? ''} onChange={e => onSetMap(r, e.target.value || null)}>
                      <option value="">Pick map…</option>
                      {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                ) : map ? (
                  <div className="map-control">
                    <span className="map-label">Map</span>
                    <span className="map-badge">🗺️ {map}</span>
                  </div>
                ) : null}
              </div>

              {Array.from({ length: cnt }, (_, b) => {
                const m     = mainCell(r, b);
                const isFed = r === 1 && b >= playInFedStart; // bId fed by play-in
                const aWon  = !!m.winnerId && m.winnerId === m.aId;
                const bWon  = !!m.winnerId && m.winnerId === m.bId;
                return (
                  <div key={b}
                    className={`bbox matchup-box${isActive && !isFed ? ' active' : ''}${isActive && !isFed && m.winnerId ? ' done' : ''}${isActive && isFed && m.bId ? ' active' : ''}${!isActive && m.winnerId ? ' done' : ''}`}
                    style={{ left: GUTTER + centers[r][b] - BOX_W/2, top: yRound(r), width: BOX_W, height: BOX_H }}
                  >
                    <Slot id={m.aId} won={aWon} lost={bWon} />
                    <Slot id={m.bId} isBye={isFed && !m.bId} won={bWon} lost={aWon} />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Play-in row (below Round 1) */}
        {hasPlayIn && (
          <div>
            <div className="round-side abs" style={{ top: yPlayIn, height: BOX_H }}>
              <span className={`row-label${playInIsActive ? ' active' : ''}`} style={{ color: playInIsActive ? 'var(--yellow)' : undefined }}>
                Play-in
              </span>
              {admin && playInIsActive ? (
                <div className="map-control">
                  <span className="map-label">Map</span>
                  <select className="map-select" value={playInRound?.map ?? ''} onChange={e => onSetMap(0, e.target.value || null)}>
                    <option value="">Pick map…</option>
                    {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              ) : playInRound?.map ? (
                <div className="map-control">
                  <span className="map-label">Map</span>
                  <span className="map-badge">🗺️ {playInRound.map}</span>
                </div>
              ) : null}
            </div>

            {Array.from({ length: extra }, (_, k) => {
              const m    = playInCell(k);
              const r1Idx = playInFedStart + k;
              const aWon = !!m.winnerId && m.winnerId === m.aId;
              const bWon = !!m.winnerId && m.winnerId === m.bId;
              return (
                <div key={k}
                  className={`bbox matchup-box play-in-box${playInIsActive ? ' active' : ''}${m.winnerId ? ' done' : ''}`}
                  style={{ left: GUTTER + centers[1][r1Idx] - BOX_W/2, top: yPlayIn, width: BOX_W, height: BOX_H }}
                >
                  <Slot id={m.aId} won={aWon} lost={bWon} />
                  <Slot id={m.bId} won={bWon} lost={aWon} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
