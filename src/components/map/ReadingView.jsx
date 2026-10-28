/**
 * Full-screen reading order for the shown paths (the pinned ones, or all):
 * numbered titles with how each follows the last, Remove and Details.
 */
export function ReadingView({ heading, total, rows, paths, shown, onTogglePath, onInfo, onRemove, onClose }) {
  return (
    <aside className="reading-view" aria-label="Reading view" onClick={(e) => e.stopPropagation()}>
      <div className="reading-head">
        <div className="reading-heading">
          <span className="reading-kicker">Reading view</span>
          <h2 className="reading-title">{heading}</h2>
          <span className="reading-sub">
            {total} {total === 1 ? 'title' : 'titles'} in reading order. Removed titles are left out; use Reset on the map to restore a path.
          </span>
        </div>
        {paths.length > 1 && (
          <div className="reading-toggles" role="group" aria-label="Paths to show">
            {paths.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`reading-toggle${shown.includes(p.id) ? ' is-on' : ''}`}
                aria-pressed={shown.includes(p.id)}
                onClick={() => onTogglePath(p.id)}
              >
                Path {p.id}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="metro-btn" onClick={onClose}>← Back to map</button>
      </div>

      <div className="reading-list">
        <div className="reading-inner">
          {rows.map((row) => {
            if (row.kind === 'header') {
              return (
                <div key={`h-${row.key}`} className="reading-path-head">
                  <span className="reading-path-pill">{row.label}</span>
                  {row.count} {row.count === 1 ? 'title' : 'titles'}
                </div>
              );
            }
            if (row.kind === 'empty') {
              return <div key={`e-${row.key}`} className="reading-empty">No titles left in this path. Use + on the map to add some back.</div>;
            }
            return (
              <div key={row.key} className="reading-item">
                <div className="reading-rail">
                  <span className={`reading-dot${row.rel ? ' has-rel' : ''}`}>{row.n}</span>
                  <span className={`reading-line${row.last ? ' is-last' : ''}`} />
                </div>
                <div className="reading-content">
                  {row.rel && <div className="reading-rel">{row.rel}</div>}
                  <div className="reading-card">
                    <div className="reading-card-text">
                      <span className="reading-card-title">{row.title}</span>
                      <span className="reading-card-meta">{row.meta}</span>
                    </div>
                    <button type="button" className="icon-btn" aria-label={`Details for ${row.title}`} onClick={() => onInfo(row.id)}>ⓘ</button>
                    <button type="button" className="icon-btn" aria-label={`Remove ${row.title} from your reading path`} onClick={() => onRemove(row.id)}>−</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
