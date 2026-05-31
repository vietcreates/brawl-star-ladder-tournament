import { useState } from 'react';
import { useTournament } from './useTournament';
import AddPlayer from './components/AddPlayer';
import BracketTree from './components/BracketTree';
import RoundPanel from './components/RoundPanel';
import PinModal from './components/PinModal';
import './App.css';

const PIN_KEY = 'brawl_pin';

export default function App() {
  const {
    players, rounds, activeRound, started, canStart, championId, currentRound, isFinals, loading,
    addPlayer, removePlayer, seedBracket, reseed, setMap, resolveMatchup, beginNextRound, resetAll,
  } = useTournament();

  const [admin, setAdmin] = useState(false);
  const [modal, setModal] = useState<null | 'set' | 'enter'>(null);

  function onManageClick() {
    if (admin) { setAdmin(false); return; }
    setModal(localStorage.getItem(PIN_KEY) ? 'enter' : 'set');
  }
  function handleSet(pin: string) {
    localStorage.setItem(PIN_KEY, pin);
    setAdmin(true);
    setModal(null);
  }
  function handleVerify(pin: string): boolean {
    const ok = pin === localStorage.getItem(PIN_KEY);
    if (ok) { setAdmin(true); setModal(null); }
    return ok;
  }
  function handleReset() {
    if (confirm('Reset the whole tournament — players, bracket and maps? This cannot be undone.')) resetAll();
  }

  return (
    <div className="app">
      <header>
        <h1>🏆 Brawl Stars Ladder</h1>
        <div className="header-actions">
          {admin && <button className="reset-btn" onClick={handleReset}>Reset All</button>}
          <button className={`lock-btn${admin ? ' on' : ''}`} onClick={onManageClick}>
            {admin ? '🔓 Managing — Lock' : '🔒 Manage'}
          </button>
        </div>
      </header>

      {loading ? (
        <section className="card"><p className="hint">Loading tournament data...</p></section>
      ) : (<>

      {/* Rules */}
      <section className="card rules-card">
        <h2>📋 Rules</h2>
        <ul className="rules-list">
          <li><strong>Game Mode:</strong> Duel</li>
          <li><strong>Format:</strong> Best of 3 on the selected map for each round</li>
          <li>You <strong>may switch brawlers</strong> between rounds of the match</li>
          <li>After a match is decided, the <strong>winner reports</strong> back to the organizer so the ladder can be updated</li>
          <li>Once the bracket is set, <strong>no re-matches</strong> — results are final</li>
        </ul>
      </section>

      {/* Prizes */}
      <section className="card prizes-card">
        <h2>🎁 Prizes</h2>
        <div className="prizes">
          <div className="prize first">
            <span className="prize-place">🥇 1st Place</span>
            <span className="prize-reward">$15 Google Play Gift Card</span>
          </div>
          <div className="prize second">
            <span className="prize-place">🥈 2nd Place</span>
            <span className="prize-reward">$5 Amazon Gift Card</span>
          </div>
          <div className="prize third">
            <span className="prize-place">🥉 3rd Place</span>
            <span className="prize-reward">$5 Amazon Gift Card</span>
          </div>
        </div>
        <p className="prize-note">Gift cards can be redeemed online. Codes will be provided to the winners.</p>
      </section>

      {admin && !started && (
        <section className="card">
          <h2>Add Player</h2>
          <AddPlayer onAdd={addPlayer} />
          {players.length > 0 && (
            <ul className="roster">
              {players.map(p => (
                <li key={p.id}>
                  {p.name}{p.isSub && <span className="sub-badge">SUB</span>}
                  <button className="roster-x" onClick={() => removePlayer(p.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card">
        <RoundPanel
          players={players}
          currentRound={currentRound}
          championId={championId}
          canStart={canStart}
          started={started}
          isFinals={isFinals}
          admin={admin}
          onSeed={seedBracket}
          onReseed={reseed}
          onResolve={resolveMatchup}
          onBeginNext={beginNextRound}
        />
      </section>

      <section className="card">
        <h2>The Bracket</h2>
        <BracketTree
          players={players}
          rounds={rounds}
          activeRound={started && !championId ? activeRound : 0}
          championId={championId}
          admin={admin}
          onSetMap={setMap}
        />
      </section>

      </>)}

      {(modal === 'set' || modal === 'enter') && (
        <PinModal mode={modal} onClose={() => setModal(null)} onSet={handleSet} onVerify={handleVerify} />
      )}
    </div>
  );
}
