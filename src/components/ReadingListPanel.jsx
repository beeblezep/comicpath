const TYPE_COLOR = {
  canon:     'var(--color-canon)',
  secondary: 'var(--color-secondary)',
  elseworld: 'var(--color-elseworld)',
};

export function ReadingListPanel({ items, onRemove, open, onClose }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 300,
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        zIndex: 11,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-lg)',
        gap: 'var(--space-md)',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>Reading list</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-muted)',
              width: 30, height: 30,
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)' }}>
            Star stories to add them here.
          </p>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderLeft: `3px solid ${TYPE_COLOR[item.type] ?? 'var(--color-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-sm) var(--space-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 2 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                  {item.character} · {item.format}
                </div>
              </div>
              <button
                onClick={() => onRemove(item.id)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--color-muted)', fontSize: 14,
                  flexShrink: 0, padding: 0,
                }}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
