import type { Player, Round } from '../types';

type Props = {
  players: Player[];
  currentRound: Round | null;
  championId: string | null;
  canStart: boolean;
  started: boolean;
  isFinals: boolean;
  admin: boolean;
  onSeed: () => void;
  onReseed: () => void;
  onResolve: (matchupId: string, winnerId: string) => void;
  onBeginNext: () => void;
};

export default function RoundPanel({
  players, currentRound, championId, canStart, started, isFinals, admin,
  onSeed, onReseed, onResolve, onBeginNext,
}: Props) {
  const name = (id: string | null) => id ? (players.find(p => p.id === id)?.name ?? '???') : '???';
  const isSub = (id: string | null) => !!id && (players.find(p => p.id === id)?.isSub ?? false);

  if (championId) {
    return (
      <div className="champion-banner">
        <div className="confetti">🎉</div>
        <h2>Champion</h2>
        <p className="champ-name">👑 {name(championId)}</p>
        <p className="champ-sub">Tournament complete!</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="round">
        <h2>Get Started</h2>
        {admin ? (
          canStart ? (
            <>
              <p className="hint">
                {players.length} players ready — shuffle to seed the bracket.
              </p>
              <button className="primary big" onClick={onSeed}>🎲 Shuffle &amp; Start Bracket</button>
            </>
          ) : (
            <p className="hint">Add at least <strong>2 players</strong> to start.</p>
          )
        ) : (
          <p className="empty">The tournament hasn't started yet.</p>
        )}
      </div>
    );
  }

  if (!currentRound) return null;

  // Separate real matchups from byes
  const realMatchups = currentRound.matchups.filter(m => m.bId !== null);
  const allResolved   = currentRound.matchups.every(m => m.winnerId);
  const realAllDone   = realMatchups.every(m => m.winnerId);
  const anyResult     = currentRound.matchups.some(m => m.winnerId);
  const canReseed     = currentRound.number <= 1 && !anyResult;
  const isPlayIn      = !!currentRound.isPlayIn;

  return (
    <div className="round">
      <div className="round-head">
        <h2>
          {isPlayIn ? 'Play-in Round' : isFinals ? 'Finals' : `Round ${currentRound.number}`}
          {currentRound.map && <span className="map-badge inline">🗺️ {currentRound.map}</span>}
        </h2>
        {admin && canReseed && (
          <div className="round-buttons">
            <button className="ghost" onClick={onReseed}>🎲 Re-shuffle</button>
          </div>
        )}
      </div>

      {!currentRound.map && admin && (
        <p className="hint">Tip: pick this round's map in the bracket section below.</p>
      )}

      {/* Play-in context hint */}
      {isPlayIn && (
        <div className="bye-notice">
          🎮 Winners advance to <strong>Round 1</strong>. Losers are eliminated.
        </div>
      )}

      {/* Real matchups */}
      {realMatchups.length > 0 && (
        <div className="matchups">
          {realMatchups.map((m, i) => {
            const aWon = m.winnerId === m.aId;
            const bWon = m.winnerId === m.bId;
            const Fighter = ({ id, won, lost }: { id: string | null; won: boolean; lost: boolean }) => {
              const label = <>{name(id)}{isSub(id) && <em> (sub)</em>}{won && ' 🏆'}</>;
              const cls = `fighter${won ? ' won' : ''}${lost ? ' lost' : ''}${admin ? '' : ' static'}`;
              return admin
                ? <button className={cls} onClick={() => id && onResolve(m.id, id)}>{label}</button>
                : <span className={cls}>{label}</span>;
            };
            return (
              <div key={m.id} className={`matchup${m.winnerId ? ' resolved' : ''}`}>
                <span className="mu-num">#{i + 1}</span>
                <Fighter id={m.aId} won={aWon} lost={bWon} />
                <span className="vs">VS</span>
                <Fighter id={m.bId} won={bWon} lost={aWon} />
              </div>
            );
          })}
        </div>
      )}

      {admin && realMatchups.length > 0 && !realAllDone && (
        <p className="hint">Tap each match's winner as players report results.</p>
      )}
      {admin && allResolved && !isFinals && (
        <button className="primary big" onClick={onBeginNext}>
          {isPlayIn ? 'End Play-in → Begin Round 1' : 'End Round → Begin Next Round'}
        </button>
      )}
      {admin && allResolved && isFinals && (
        <p className="hint done">Champion decided — see the trophy above! 🏆</p>
      )}
      {!admin && allResolved && <p className="hint done">Round complete.</p>}
    </div>
  );
}
