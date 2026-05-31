import { useState } from 'react';

type Props = {
  mode: 'set' | 'enter';
  onClose: () => void;
  onSet: (pin: string) => void;
  onVerify: (pin: string) => boolean;
};

export default function PinModal({ mode, onClose, onSet, onVerify }: Props) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = val.trim();
    if (!v) return;
    if (mode === 'set') {
      onSet(v);
    } else if (!onVerify(v)) {
      setErr('Incorrect PIN');
      setVal('');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3>{mode === 'set' ? '🔐 Set Manager PIN' : '🔒 Enter Manager PIN'}</h3>
        <p className="modal-sub">
          {mode === 'set'
            ? 'Create a PIN so only you can manage the ladder. Keep it to yourself.'
            : 'Enter your PIN to manage the ladder.'}
        </p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={val}
          placeholder="PIN"
          onChange={e => { setVal(e.target.value); setErr(''); }}
        />
        {err && <p className="modal-err">{err}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary">{mode === 'set' ? 'Save PIN' : 'Unlock'}</button>
        </div>
      </form>
    </div>
  );
}
