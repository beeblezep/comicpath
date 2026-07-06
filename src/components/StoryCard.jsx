import { useState } from 'react';

const BORDER_COLOR = {
  canon:     'var(--color-canon)',
  secondary: 'var(--color-secondary)',
  elseworld: 'var(--color-elseworld)',
  skip:      'var(--color-skip)',
};

export function StoryCard({ story, type, character, onToggleSave, isSaved }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = story.issueList?.length > 0;
  const accentColor = BORDER_COLOR[type] ?? 'var(--color-border)';

  const itemId = `${character}-${story.title}`.replace(/\s+/g, '-').toLowerCase();

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        opacity: type === 'skip' ? 0.6 : 1,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', lineHeight: 1.3 }}>
          {story.title}
        </span>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
          {type !== 'skip' && (
            <button
              onClick={() => onToggleSave({ id: itemId, title: story.title, type, format: story.format, character })}
              title={isSaved ? 'Remove from list' : 'Save to reading list'}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: isSaved ? 'var(--color-secondary)' : 'var(--color-muted)',
                width: 28, height: 28,
                fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isSaved ? '★' : '☆'}
            </button>
          )}
          {hasIssues && (
            <button
              onClick={() => setExpanded(e => !e)}
              title="Show issues"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-muted)',
                width: 28, height: 28,
                fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {expanded ? '▴' : '▾'}
            </button>
          )}
        </div>
      </div>

      {/* Why */}
      {story.why && (
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 10 }}>
          {story.why}
        </p>
      )}

      {/* Pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {story.format && <Pill>{story.format}</Pill>}
        {story.year   && <Pill>{story.year}</Pill>}
        {story.issues && <Pill>{story.issues}</Pill>}
        {story.readFirst && <Pill color="var(--color-canon)">Start here</Pill>}
      </div>

      {/* Issue drill-down */}
      {expanded && hasIssues && (
        <div style={{ marginTop: 12 }}>
          {story.issueList.map((issue, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                padding: '5px 0',
                borderBottom: i < story.issueList.length - 1 ? '1px solid var(--color-border)' : 'none',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <span style={{ color: 'var(--color-muted)', minWidth: 28 }}>#{issue.num}</span>
              <span style={{ flex: 1 }}>{issue.name || `Issue ${issue.num}`}</span>
              {issue.note && (
                <span style={{ color: 'var(--color-muted)', fontStyle: 'italic', fontSize: 12 }}>
                  {issue.note}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ children, color }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 20,
        border: '1px solid var(--color-border)',
        color: color ?? 'var(--color-muted)',
        background: 'transparent',
      }}
    >
      {children}
    </span>
  );
}
