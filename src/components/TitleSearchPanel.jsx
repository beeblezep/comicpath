import { useState, useRef, useCallback } from 'react';
import { searchVolumes, searchStoryArcs } from '../lib/comicvine';

const MONO = "'SF Mono', Menlo, Consolas, monospace";

export function TitleSearchPanel({ onSelect, initialQuery }) {
  const [value, setValue] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (query) => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const [volumes, arcs] = await Promise.all([
        searchVolumes(q).catch(() => []),
        searchStoryArcs(q).catch(() => []),
      ]);

      const seen = new Set();
      const combined = [];
      for (const v of volumes) {
        const key = v.name?.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        combined.push({
          name: v.name,
          year: v.startYear || '',
          publisher: v.publisher || '',
          issueCount: v.issueCount || '',
          deck: v.deck || '',
          type: 'volume',
        });
      }
      for (const a of arcs) {
        const key = a.name?.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        combined.push({
          name: a.name,
          year: '',
          publisher: a.publisher || '',
          issueCount: '',
          deck: a.deck || '',
          type: 'story_arc',
        });
      }
      setResults(combined);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleChange(e) {
    const v = e.target.value;
    setValue(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 400);
  }

  function handleSubmit() {
    clearTimeout(debounceRef.current);
    doSearch(value);
  }

  return (
    <div style={{ padding: '32px 20px 16px', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
        Build your reading path.
      </h1>
      <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
        Search for a title to start building your custom reading path.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          type="text"
          value={value}
          placeholder="Batman: Year One, Saga, House of X..."
          onChange={handleChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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
          onClick={handleSubmit}
          disabled={!value.trim()}
          style={{
            padding: '11px 20px',
            background: 'var(--color-canon)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            opacity: !value.trim() ? 0.5 : 1,
          }}
        >
          Search
        </button>
      </div>

      {searching && (
        <p style={{ color: 'var(--color-muted)', fontSize: 13, padding: '12px 0' }}>
          Searching...
        </p>
      )}

      {!searching && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {results.map((r, i) => (
            <button
              key={`${r.name}-${i}`}
              onClick={() => onSelect(r)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                  {r.name}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-muted)' }}>
                  {[r.publisher, r.year, r.issueCount ? `${r.issueCount} issues` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{
                fontFamily: MONO, fontSize: 10, color: 'var(--color-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {r.type === 'story_arc' ? 'Arc' : 'Series'}
              </span>
            </button>
          ))}
        </div>
      )}

      {!searching && value.trim() && results.length === 0 && (
        <p style={{ color: 'var(--color-muted)', fontSize: 13, padding: '12px 0' }}>
          No results found. Try a different title.
        </p>
      )}
    </div>
  );
}
