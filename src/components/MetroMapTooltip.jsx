const TIER_LABELS = { essential: 'Essential', recommended: 'Worth Reading', optional: 'Optional' };
const TIER_COLORS = {
  essential: 'var(--color-tier-essential)',
  recommended: 'var(--color-tier-recommended)',
  optional: 'var(--color-tier-optional)',
};

export function MetroMapTooltip({ node, onClose, isSaved, onToggleSave, containerRef }) {
  const left = Math.min(node.x + node.r + 16, (containerRef?.current?.offsetWidth || 500) - 260);
  const top = node.y - 10;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: 240,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        zIndex: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.3, flex: 1 }}>
          {node.title}
        </h4>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--color-muted)',
            fontSize: 16, cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, padding: '2px 8px',
          borderRadius: 20, fontWeight: 600,
          color: TIER_COLORS[node.tier],
          border: `1px solid ${TIER_COLORS[node.tier]}`,
        }}>
          {TIER_LABELS[node.tier] || node.tier}
        </span>
        {node.year && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            {node.year}
          </span>
        )}
        {node.issues && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
            {node.issues}
          </span>
        )}
      </div>

      {node.why && (
        <p style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, margin: '0 0 10px' }}>
          {node.why}
        </p>
      )}

      <button
        onClick={onToggleSave}
        style={{
          width: '100%',
          padding: '6px 0',
          background: isSaved ? 'rgba(124,92,252,0.15)' : 'transparent',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: isSaved ? 'var(--color-canon)' : 'var(--color-muted)',
          fontSize: 12,
          cursor: 'pointer',
          fontWeight: isSaved ? 600 : 400,
        }}
      >
        {isSaved ? '★ Saved' : '☆ Save to reading list'}
      </button>
    </div>
  );
}
