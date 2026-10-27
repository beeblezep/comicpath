const TIERS = [
  { key: 'essential', label: 'Essential', color: '#7c5cfc' },
  { key: 'recommended', label: 'Recommended', color: '#e8a33d' },
  { key: 'optional', label: 'Optional', color: '#7c7c8a' },
];

const MONO = "'SF Mono', Menlo, Consolas, monospace";

export function ConstellationToolbar({ tierFilter, onToggleTier, showHidden, onToggleShowHidden, visibleCount, totalCount }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {TIERS.map((t) => {
        const active = tierFilter.has(t.key);
        return (
          <button
            key={t.key}
            onClick={() => onToggleTier(t.key)}
            style={{
              fontFamily: MONO,
              fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '5px 12px',
              border: `1px solid ${active ? t.color : '#2a2b38'}`,
              background: active ? `${t.color}18` : 'transparent',
              color: active ? t.color : '#7c7c8a',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        );
      })}

      <button
        onClick={onToggleShowHidden}
        style={{
          fontFamily: MONO,
          fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '5px 12px',
          border: '1px solid #2a2b38',
          background: showHidden ? 'rgba(255,255,255,0.05)' : 'transparent',
          color: '#7c7c8a',
          cursor: 'pointer',
        }}
      >
        {showHidden ? 'Hide removed' : 'Show removed'}
      </button>

      <span style={{ fontFamily: MONO, fontSize: 10, color: '#7c7c8a', marginLeft: 8 }}>
        {visibleCount} / {totalCount}
      </span>
    </div>
  );
}
