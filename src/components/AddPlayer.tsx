import { useState } from 'react';

type Props = { onAdd: (name: string, isSub: boolean) => void };

export default function AddPlayer({ onAdd }: Props) {
  const [name, setName] = useState('');
  const [isSub, setIsSub] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, isSub);
    setName('');
    setIsSub(false);
  }

  return (
    <form className="add-player" onSubmit={submit}>
      <input
        placeholder="Player name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <label className="sub-toggle">
        <input type="checkbox" checked={isSub} onChange={e => setIsSub(e.target.checked)} />
        Sub
      </label>
      <button type="submit">Add</button>
    </form>
  );
}
