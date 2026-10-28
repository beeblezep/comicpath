import { CARD_W, CARD_H } from '../../lib/metroLayout';
import { CategoryTag } from './CategoryTag';

/**
 * One title on the map. Clicking selects it (shift/⌘-click picks it for the
 * chat); the ± button adds, skips or removes it; ⓘ opens the details drawer.
 * The second line offers Expand, or Show/Hide for titles it already expanded.
 */
export function TitleCard({
  node, x, y, onPath, skipped, dim, faded, selected, inChat, isRead, inPath, toggleLabel,
  expand, onSelect, onToggle, onInfo, onExpand, onToggleCollapsed,
}) {
  const classes = [
    'title-card', `cat-${node.category}`,
    onPath && !skipped && 'on-path', skipped && 'is-skipped',
    dim && 'is-dim', faded && 'is-faded', selected && 'is-selected', inChat && 'is-chat',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ left: x, top: y, width: CARD_W, height: CARD_H }} data-card={node.id}>
      <button
        type="button"
        className="title-card-main"
        aria-pressed={selected}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id, e); }}
      >
        <span className="title-card-title">{node.title}</span>
      </button>
      <span className="title-card-meta">
        <CategoryTag category={node.category} />
        {isRead && <span className="title-card-read">✓ Read</span>}
        {expand === 'expanding' && <span>Expanding…</span>}
        {expand === 'expand' && (
          <button type="button" className="title-card-link" onClick={(e) => { e.stopPropagation(); onExpand(node.id); }}>
            Expand
          </button>
        )}
        {(expand === 'shown' || expand === 'collapsed') && (
          <button
            type="button"
            className="title-card-link"
            aria-expanded={expand === 'shown'}
            onClick={(e) => { e.stopPropagation(); onToggleCollapsed(node.id); }}
          >
            {expand === 'shown' ? 'Hide expanded' : 'Show expanded'}
          </button>
        )}
        {!expand && !isRead && node.year && <span>{node.year}</span>}
      </span>
      <button
        type="button"
        className="title-card-toggle"
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={(e) => { e.stopPropagation(); onToggle(node); }}
      >
        <span className={`toggle-dot${inPath ? '' : ' is-out'}`}>{inPath ? '−' : '+'}</span>
      </button>
      <button
        type="button"
        className="title-card-info"
        aria-label={`Details for ${node.title}`}
        onClick={(e) => { e.stopPropagation(); onInfo(node.id); }}
      >
        ⓘ
      </button>
    </div>
  );
}
