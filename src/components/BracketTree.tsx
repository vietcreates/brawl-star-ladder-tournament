import type { Player, Round, Matchup } from '../types';
import { MAPS, nextPow2 } from '../types';

type Props = {
  players: Player[];
  rounds: Round[];
  activeRound: number;
  championId: string | null;
  admin: boolean;
  onSetMap: (roundNumber: number, map: string | null) => void;
};

// Geometry
const SLOT_W = 120;
const SLOT_H = 40;
const INNER_GAP = 8;
const PAD = 6;
const BOX_W = 2 * SLOT_W + INNER_GAP + 2 * PAD;
const BOX_H = SLOT_H + 2 * PAD;
const BOX_GAP = 32;
const ROW_PITCH = 110;
const GUTTER = 130;

export default function BracketTree({ players, rounds, activeRound, championId, admin, onSetMap }: Props) {
  const pname = (id: string | null) => id ? (players.find(p => p.id === id)?.name ?? '???') : null;
  const isSub = (id: string | null) => !!id && (players.find(p => p.id === id)?.isSub ?? false);

  const started = rounds.length > 0;
  // Bracket size = next power of 2 above player count
  const N = started ? rounds[0].matchups.length * 2 : nextPow2(Math.max(players.length, 2));

  if (players.length < 2) {
    return <p className="empty">Add at least 2 players to draw the bracket.</p>;
  }

  const R = Math.log2(N);

  // How many byes are in Round 1 (pre-start preview)
  const byeCount = N - players.length;

  // Get the matchup cell at round r (1-based), index b
  const cell = (r: number, b: number): Matchup => {
    const round = rounds[r - 1];
    if (round) return round.matchups[b];
    // Pre-start preview for Round 1
    if (r === 1) {
      if (b < byeCount) {
        const playerId = players[b]?.id ?? null;
        return { id: `bye${b}`, aId: playerId, bId: null, winnerId: playerId };
      }
      const offset = (b - byeCount) * 2;
      const aIdx = byeCount + offset;
      const bIdx = aIdx + 1;
      return { id: `p${b}`, aId: players[aIdx]?.id ?? null, bId: players[bIdx]?.id ?? null, winnerId: null };
    }
    return { id: `e${r}-${b}`, aId: null, bId: null, winnerId: null };
  };

  // Horizontal center x per matchup, bottom-up
  const centers: number[][] = [];
  centers[1] = Array.from({ length: N / 2 }, (_, b) => b * (BOX_W + BOX_GAP) + BOX_W / 2);
  for (let r = 2; r <= R; r++) {
    const cnt = N / 2 ** r;
    centers[r] = Array.from({ length: cnt }, (_, b) => (centers[r - 1][2 * b] + centers[r - 1][2 * b + 1]) / 2);
  }
  const totalW = (N / 2) * BOX_W + (N / 2 - 1) * BOX_GAP;
  const championX = centers[R][0];

  const yRound = (r: number) => (R - r + 1) * ROW_PITCH;
  const yChamp = 0;
  const totalH = R * ROW_PITCH + BOX_H;

  // SVG connector lines — green when winner is decided
  const lines: { x1: number; y1: number; x2: number; y2: number; green: boolean }[] = [];
  for (let r = 1; r <= R; r++) {
    const cnt = N / 2 ** r;
    for (let b = 0; b < cnt; b++) {
      const childTopX = GUTTER + centers[r][b];
      const childTopY = yRound(r);
      const parentX = r < R ? GUTTER + centers[r + 1][Math.floor(b / 2)] : GUTTER + championX;
      const parentBottomY = r < R ? yRound(r + 1) + BOX_H : yChamp + SLOT_H;
      lines.push({ x1: childTopX, y1: childTopY, x2: parentX, y2: parentBottomY, green: !!cell(r, b).winnerId });
    }
  }

  // A single player slot inside a matchup box
  const Slot = ({ id, isBye, won, lost, champ }: { id: string | null; isBye?: boolean; won?: boolean; lost?: boolean; champ?: boolean }) => {
    if (isBye) return (
      <div className="bslot bye-slot">
        <span className="bslot-name">BYE</span>
      </div>
    );
    return (
      <div className={`bslot${id ? ' filled' : ' empty'}${won ? ' won' : ''}${lost ? ' lost' : ''}${champ ? ' champ' : ''}`}>
        {champ && id && <span className="crown">👑</span>}
        <span className="bslot-name">{pname(id) ?? 'TBD'}</span>
        {isSub(id) && <span className="sub-badge">SUB</span>}
      </div>
    );
  };

  const label = (r: number) => (r === R ? 'Finals' : `Round ${r}`);

  return (
    <div className="bracket-scroll">
      <div className="bracket-tree" style={{ width: GUTTER + totalW, height: totalH }}>
        <svg className="bracket-lines" width={GUTTER + totalW} height={totalH}>
          {lines.map((l, i) => (
            <polyline
              key={i}
              points={`${l.x1},${l.y1} ${l.x1},${(l.y1 + l.y2) / 2} ${l.x2},${(l.y1 + l.y2) / 2} ${l.x2},${l.y2}`}
              className={`connector${l.green ? ' green' : ''}`}
            />
          ))}
        </svg>

        {/* Champion slot */}
        <div className="bbox champion-box" style={{ left: GUTTER + championX - SLOT_W / 2, top: yChamp, width: SLOT_W, height: SLOT_H }}>
          <Slot id={championId} champ won={!!championId} />
        </div>

        {/* Round rows */}
        {Array.from({ length: R }, (_, ri) => {
          const r = ri + 1;
          const cnt = N / 2 ** r;
          const map = rounds[r - 1]?.map ?? null;
          const isActive = r === activeRound;
          return (
            <div key={r}>
              <div className="round-side abs" style={{ top: yRound(r), height: BOX_H }}>
                <span className={`row-label${isActive ? ' active' : ''}`}>{label(r)}</span>
                {admin && isActive ? (
                  <select className="map-select" value={map ?? ''} onChange={e => onSetMap(r, e.target.value || null)}>
                    <option value="">Pick map…</option>
                    {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : map ? (
                  <span className="map-badge">🗺️ {map}</span>
                ) : isActive ? (
                  <span className="map-badge muted">No map</span>
                ) : null}
              </div>

              {Array.from({ length: cnt }, (_, b) => {
                const m = cell(r, b);
                const isByeMatchup = m.bId === null;
                const aWon = !!m.winnerId && m.winnerId === m.aId;
                const bWon = !!m.winnerId && m.winnerId === m.bId;
                return (
                  <div
                    key={b}
                    className={`bbox matchup-box${isActive && !isByeMatchup ? ' active' : ''}${m.winnerId ? ' done' : ''}${isByeMatchup ? ' bye-box' : ''}`}
                    style={{ left: GUTTER + centers[r][b] - BOX_W / 2, top: yRound(r), width: BOX_W, height: BOX_H }}
                  >
                    <Slot id={m.aId} won={aWon} lost={bWon && !isByeMatchup} />
                    <Slot id={m.bId} isBye={isByeMatchup} won={bWon} lost={aWon && !isByeMatchup} />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Champion label */}
        <div className="round-side abs" style={{ top: yChamp, height: SLOT_H }}>
          <span className="row-label champ">🏆 Champion</span>
        </div>
      </div>
    </div>
  );
}
