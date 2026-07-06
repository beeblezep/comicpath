import { useState } from 'react';

const QUICK_PICKS = [
  'Batman',
  'Spider-Man',
  'X-Men',
  'Wonder Woman',
  'The Sandman',
  'Saga',
];

export function SearchBar({ onSearch, loading }) {
  const [value, setValue] = useState('');

  function submit() {
    const q = value.trim();
    if (q) onSearch(q);
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {QUICK_PICKS.map(label => (
          <button
            key={label}
            onClick={() => { setValue(label); onSearch(label); }}
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
