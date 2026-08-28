const TIER_COLORS = {
  essential: '#7c5cfc',
  recommended: '#e8a33d',
  optional: '#7c7c8a',
};

const TIER_LABELS = {
  essential: 'Essential',
  recommended: 'Recommended',
  optional: 'Optional',
};

const MONO = "'SF Mono', Menlo, Consolas, monospace";

export function ConstellationDetail({ node, open, readingList, alreadyRead, character, onToggleRead, onHide, onClose, nodeIndex, totalNodes, onExpand, expandable, expanding }) {
  const color = node ? (TIER_COLORS[node.tier] || TIER_COLORS.recommended) : '#7c7c8a';

  const prefix = character || (node ? node.title : '');
  const slug = node
    ? `${prefix}-${node.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : '';

  const isRead = node ? alreadyRead.isRead(slug) : false;
  const isSaved = node ? readingList.has(slug) : false;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380,
        background: 'linear-gradient(180deg, #1b1c26, #14141d)',
        borderLeft: '1px solid #2a2b38',
        transform: open && node ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .35s cubic-bezier(.2,.8,.2,1)',
        padding: '40px 34px',
        zIndex: 110,
        overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {node && (
        <>
          <span style={{
            fontFamily: MONO,
            fontSize: 11, letterSpacing: '0.12em',
            color: '#e8a33d', textTransform: 'uppercase',
            display: 'block', marginBottom: 14,
          }}>
            {String(nodeIndex + 1).padStart(2, '0')} / {String(totalNodes).padStart(2, '0')}
          </span>

          <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 500, letterSpacing: '-0.01em', color: '#eae7de' }}>
            {node.title}
          </h2>

          <p style={{ fontFamily: MONO, fontSize: 13, color: '#7c7c8a', margin: '0 0 22px' }}>
            {TIER_LABELS[node.tier] || 'Recommended'} · {node.year || ''}
          </p>

          <div style={{ width: '100%', height: 3, background: color, marginBottom: 22 }} />

          {node.issues && (
            <p style={{ fontFamily: MONO, fontSize: 12, color: '#7c7c8a', margin: '0 0 16px' }}>
              {node.issues}
            </p>
          )}

          {node.why && (
            <p style={{ fontFamily: MONO, fontSize: 13, lineHeight: 1.7, color: '#c9c7bd', margin: '0 0 26px' }}>
              {node.why}
            </p>
          )}

          {node.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
              {node.tags.map((tag) => (
                <span key={tag} style={{
                  fontFamily: MONO,
                  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                  border: '1px solid #2a2b38', padding: '5px 10px', color: '#7c7c8a',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onExpand && (
              <button
                onClick={() => !expanding && expandable && onExpand(node.id)}
                disabled={expanding || !expandable}
                style={{
                  width: '100%', fontFamily: MONO,
                  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '10px 14px', marginBottom: 4,
                  border: `1px solid ${expandable ? color : '#2a2b38'}`,
                  background: expandable ? `${color}22` : 'transparent',
                  color: expandable ? color : '#555',
                  cursor: expandable && !expanding ? 'pointer' : 'default',
                  opacity: expanding ? 0.6 : 1,
                }}
              >
                {expanding ? 'Expanding…' : expandable ? '+ Expand' : 'Expanded ✓'}
              </button>
            )}
            <button
              onClick={() => onToggleRead(slug)}
              style={{
                flex: 1, fontFamily: MONO,
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '10px 14px',
                border: `1px solid ${isRead ? '#7c5cfc' : '#2a2b38'}`,
                background: isRead ? 'rgba(124,92,252,0.15)' : 'transparent',
                color: isRead ? '#7c5cfc' : '#7c7c8a',
                cursor: 'pointer',
              }}
            >
              {isRead ? '✓ Read' : 'Mark read'}
            </button>
            <button
              onClick={() => {
                readingList.toggle({
                  id: slug,
                  title: node.title,
                  type: node.tier,
                  format: node.issues || '',
                  character,
                });
              }}
              style={{
                flex: 1, fontFamily: MONO,
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '10px 14px',
                border: `1px solid ${isSaved ? '#e8a33d' : '#2a2b38'}`,
                background: isSaved ? 'rgba(232,163,61,0.15)' : 'transparent',
                color: isSaved ? '#e8a33d' : '#7c7c8a',
                cursor: 'pointer',
              }}
            >
              {isSaved ? '★ Saved' : 'Save'}
            </button>
            <button
              onClick={() => onHide(node.id)}
              style={{
                fontFamily: MONO,
                fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '10px 14px',
                border: '1px solid #2a2b38',
                background: 'transparent',
                color: '#7c7c8a',
                cursor: 'pointer',
              }}
            >
              Hide
            </button>
          </div>
        </>
      )}
    </div>
  );
}
