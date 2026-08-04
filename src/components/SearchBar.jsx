import { useState } from 'react';

const QUICK_PICKS = [
  'Batman',
  'Spider-Man',
  'X-Men',
  'Wonder Woman',
  'The Sandman',
  'Saga',
];

const MODES = [
  { key: 'full', label: 'Full Guide', desc: 'Complete reading path from origin to present' },
  { key: 'catch-up', label: 'Catch Up', desc: 'Jump back in from a recent starting point' },
  { key: 'deep-dive', label: 'Deep Dive', desc: 'Prerequisites for the latest major arc' },
];

export function SearchBar({ onSearch, loading }) {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState('full');

  function submit() {
    const q = value.trim();
    if (q) onSearch(q, mode);
  }

  return (
    <div style={{ padding: '32px 20px 16px', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
        Find your next read.
      </h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
        Search any character, team, or series — get a ranked reading guide.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          type="text"
          value={value}
          placeholder="Batman, X-Men, Saga..."
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          disabled={loading}
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
          onClick={submit}
          disabled={loading || !value.trim()}
          style={{
            padding: '11px 20px',
            background: 'var(--color-canon)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            opacity: loading || !value.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Loading...' : 'Explore'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            disabled={loading}
            title={m.desc}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: mode === m.key ? 'var(--color-canon)' : 'var(--color-surface)',
              color: mode === m.key ? '#fff' : 'var(--color-muted)',
              border: 'none',
              fontSize: 12,
              fontWeight: mode === m.key ? 600 : 400,
              cursor: 'pointer',
              borderRight: m.key !== 'deep-dive' ? '1px solid var(--color-border)' : 'none',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {QUICK_PICKS.map(label => (
          <button
            key={label}
            onClick={() => { setValue(label); onSearch(label, mode); }}
            disabled={loading}
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
