import { useState, useEffect, useRef } from 'react';

const TIER_COLORS = {
  essential: '#7c5cfc',
  recommended: '#e8a33d',
  optional: '#7c7c8a',
};

const MONO = "'SF Mono', Menlo, Consolas, monospace";

export const CHAT_WIDTH = 360;

const labelStyle = {
  fontFamily: MONO,
  fontSize: 11, letterSpacing: '0.12em',
  color: '#e8a33d', textTransform: 'uppercase',
};

const linkButtonStyle = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  background: 'none', border: 'none', padding: 0,
  color: '#7c7c8a', cursor: 'pointer',
};

const tagStyle = {
  border: '1px solid #2a2b38', padding: '1px 5px', marginRight: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const FORMATS = [
  { id: 'issues', label: 'Issues', answer: 'Single issues' },
  { id: 'collected', label: 'Collected', answer: 'Collected editions' },
];

function HistoryEntry({ entry, onReuse }) {
  const status = entry.status === 'asking'
    ? <span style={{ color: '#e8a33d' }}>Choose a format…</span>
    : entry.status === 'pending'
    ? <span style={{ color: '#e8a33d' }}>Expanding…</span>
    : entry.status === 'error'
      ? <span style={{ color: '#e06666' }}>{entry.error}</span>
      : <span style={{ color: '#7c5cfc' }}>+{entry.added} {entry.added === 1 ? 'node' : 'nodes'}</span>;

  return (
    <button
      onClick={() => onReuse(entry)}
      title="Reuse this prompt and selection"
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        fontFamily: MONO,
        padding: '10px 12px',
        background: '#14141d',
        border: '1px solid #2a2b38',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 12, lineHeight: 1.6, color: entry.prompt ? '#c9c7bd' : '#7c7c8a', marginBottom: 6, whiteSpace: 'pre-wrap' }}>
        {entry.prompt || '(no prompt)'}
      </div>
      {entry.note && (
        <div style={{ fontSize: 11, lineHeight: 1.6, color: '#8f8d9c', marginBottom: 8, paddingLeft: 8, borderLeft: '2px solid #7c5cfc' }}>
          {entry.note}
        </div>
      )}
      <div style={{ fontSize: 10, lineHeight: 1.6, color: '#7c7c8a', marginBottom: 4 }}>
        {entry.source === 'drawer' && <span style={tagStyle}>drawer</span>}
        {entry.format && <span style={tagStyle}>{entry.format}</span>}
        → {entry.nodeTitles.join(', ')}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.04em' }}>{status}</div>
    </button>
  );
}

export function ConstellationChat({
  open, onToggle, nodes, selectedIds, onToggleSelect, onSetSelection, onClearSelection,
  seedNodeId, focusedNode, history, busy, onSend,
  format, onSetFormat, formatQuestion, onAnswerFormat, onCancelFormat,
}) {
  const [prompt, setPrompt] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [history, formatQuestion]);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const selectedNodes = [...selectedIds].map((id) => nodeById.get(id)).filter(Boolean);
  const seedNode = seedNodeId ? nodeById.get(seedNodeId) : null;
  const targetIds = selectedNodes.length > 0
    ? selectedNodes.map((n) => n.id)
    : seedNode ? [seedNode.id] : [];

  const trimmed = prompt.trim();
  const canSend = !busy && !formatQuestion && targetIds.length > 0 && (trimmed.length > 0 || selectedNodes.length > 0);

  function send() {
    if (!canSend) return;
    onSend(targetIds, trimmed);
    setPrompt('');
  }

  function reuse(entry) {
    setPrompt(entry.prompt);
    onSetSelection(entry.nodeIds.filter((id) => nodeById.has(id)));
  }

  return (
    <>
      {/* Collapsed tab */}
      <button
        onClick={onToggle}
        style={{
          position: 'fixed', top: '50%', left: 0,
          transform: open ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
          transition: 'transform .35s cubic-bezier(.2,.8,.2,1)',
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '14px 10px',
          border: '1px solid #2a2b38', borderLeft: 'none',
          background: 'rgba(8,8,13,0.9)',
          color: '#7c7c8a',
          cursor: 'pointer',
          zIndex: 109,
        }}
      >
        Chat ›
      </button>

      <div
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: CHAT_WIDTH,
          background: 'linear-gradient(180deg, #1b1c26, #14141d)',
          borderRight: '1px solid #2a2b38',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .35s cubic-bezier(.2,.8,.2,1)',
          padding: '30px 24px 24px',
          boxSizing: 'border-box',
          zIndex: 110,
          display: 'flex', flexDirection: 'column',
          fontFamily: MONO,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={labelStyle}>Expand chat</span>
          <button onClick={onToggle} style={linkButtonStyle}>‹ Hide</button>
        </div>

        {/* History */}
        <div
          ref={listRef}
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}
        >
          {history.length === 0 ? (
            <p style={{ fontSize: 12, lineHeight: 1.7, color: '#7c7c8a', margin: 0 }}>
              Ask for more of the path here, e.g. “add the Robin stories” or “focus on crossover events”.
              Shift-click nodes to choose what to expand.
            </p>
          ) : (
            history.map((entry) => <HistoryEntry key={entry.id} entry={entry} onReuse={reuse} />)
          )}
          {formatQuestion && (
            <div style={{ padding: '10px 12px', background: '#14141d', border: '1px solid #7c5cfc' }}>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#c9c7bd', marginBottom: 8 }}>
                Single issues or collected editions?
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onAnswerFormat(f.id)}
                    style={{
                      flex: 1, fontFamily: MONO, fontSize: 11,
                      padding: '8px 6px',
                      border: '1px solid #7c5cfc',
                      background: 'rgba(124,92,252,0.13)',
                      color: '#7c5cfc',
                      cursor: 'pointer',
                    }}
                  >
                    {f.answer}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7c7c8a' }}>
                <span>You can change this any time below</span>
                <button onClick={onCancelFormat} style={linkButtonStyle}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Targets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedNodes.length > 0 ? (
            selectedNodes.map((n) => {
              const color = TIER_COLORS[n.tier] || TIER_COLORS.recommended;
              return (
                <span key={n.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, padding: '4px 8px',
                  border: `1px solid ${color}`, background: `${color}18`, color,
                  maxWidth: '100%',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  <button
                    onClick={() => onToggleSelect(n.id)}
                    aria-label={`Remove ${n.title}`}
                    style={{ background: 'none', border: 'none', padding: 0, color, cursor: 'pointer', fontSize: 12 }}
                  >
                    ×
                  </button>
                </span>
              );
            })
          ) : seedNode ? (
            <span style={{ fontSize: 11, padding: '4px 8px', border: '1px dashed #2a2b38', color: '#7c7c8a' }}>
              Seed: {seedNode.title}
            </span>
          ) : null}
          {focusedNode && !selectedIds.has(focusedNode.id) && (
            <button
              onClick={() => onToggleSelect(focusedNode.id)}
              style={{
                fontFamily: MONO, fontSize: 11, padding: '4px 8px',
                border: '1px dashed #3a3b48', background: 'transparent',
                color: '#c9c7bd', cursor: 'pointer',
              }}
            >
              + {focusedNode.title}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 10, color: '#555' }}>
          <span>shift-click nodes to select</span>
          {selectedNodes.length > 0 && (
            <button onClick={onClearSelection} style={linkButtonStyle}>Clear</button>
          )}
        </div>

        {/* Format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: '#555' }}>build from</span>
          <div style={{ display: 'flex', flex: 1 }}>
            {FORMATS.map((f, i) => {
              const active = format === f.id;
              return (
                <button
                  key={f.id}
                  aria-pressed={active}
                  onClick={() => (formatQuestion ? onAnswerFormat(f.id) : onSetFormat(f.id))}
                  style={{
                    flex: 1, fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '5px 8px',
                    border: `1px solid ${active ? '#7c5cfc' : '#2a2b38'}`,
                    marginLeft: i === 0 ? 0 : -1,
                    position: 'relative', zIndex: active ? 1 : 0,
                    background: active ? 'rgba(124,92,252,0.13)' : 'transparent',
                    color: active ? '#7c5cfc' : '#7c7c8a',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="e.g. now include Robin stories, add crossover events…"
          rows={3}
          style={{
            width: '100%', fontFamily: MONO,
            fontSize: 12, lineHeight: 1.6,
            padding: '8px 10px', marginBottom: 8,
            background: '#14141d',
            border: '1px solid #2a2b38',
            color: '#c9c7bd',
            resize: 'vertical',
            minHeight: 60, maxHeight: 160,
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          style={{
            width: '100%', fontFamily: MONO,
            fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '10px 14px',
            border: '1px solid #7c5cfc',
            background: 'rgba(124,92,252,0.13)',
            color: '#7c5cfc',
            cursor: canSend ? 'pointer' : 'default',
            opacity: canSend ? 1 : 0.5,
          }}
        >
          {busy ? 'Expanding…' : '+ Expand ↵'}
        </button>
      </div>
    </>
  );
}
