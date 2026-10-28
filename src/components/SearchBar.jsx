import { useState } from 'react';

const EXAMPLES = [
  "I'm new to Batman",
  'Catch me up on Absolute Power',
  'Deep cuts for the X-Men',
  'Titles about Batman and Robin',
  'The Sandman',
  'Saga',
];

export function SearchBar({ onSearch, onResume, savedTitle }) {
  const [value, setValue] = useState('');

  function submit(q = value.trim()) {
    if (!q) return;
    onSearch(q);
  }

  return (
    <div style={{ padding: '32px 20px 16px', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
        Find your next read.
      </h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
        Ask for any character, team, or story arc — and say whether you're new, catching up, or after deep cuts.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          type="text"
          value={value}
          placeholder="e.g. catch me up on Absolute Power"
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{
            flex: 1,
            padding: '11px 14px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-base)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => submit()}
          disabled={!value.trim()}
          style={{
            padding: '11px 20px',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            opacity: !value.trim() ? 0.5 : 1,
          }}
        >
          Explore
        </button>
      </div>

      {savedTitle !== null && (
        <button
          onClick={onResume}
          style={{
            display: 'block', width: '100%', marginBottom: 14,
            padding: '10px 16px', textAlign: 'left',
            background: 'rgba(124,92,252,0.08)',
            border: '1px solid rgba(124,92,252,0.25)',
            borderRadius: 'var(--radius-sm)',
            color: '#7c5cfc',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Resume: {savedTitle || 'saved reading path'} →
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {EXAMPLES.map(label => (
          <button
            key={label}
            onClick={() => { setValue(label); submit(label); }}
            style={{
              padding: '5px 12px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 20,
              color: 'var(--color-muted)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
