import { useState, useEffect, useRef } from 'react';
import { categoryMeta } from '../lib/model';
import { ClarifyQuestion } from './ClarifyQuestion';

const MONO = "'SF Mono', Menlo, Consolas, monospace";

const CHAT_WIDTH = 360;

const labelStyle = {
  fontFamily: MONO,
  fontSize: 11, letterSpacing: '0.12em',
  color: 'var(--chat-pending)', textTransform: 'uppercase',
};

const linkButtonStyle = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  background: 'none', border: 'none', padding: 0,
  color: 'var(--chat-muted)', cursor: 'pointer',
};

const tagStyle = {
  border: '1px solid var(--chat-border)', padding: '1px 5px', marginRight: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const FORMATS = [
  { id: 'issues', label: 'Issues', answer: 'Single issues' },
  { id: 'collected', label: 'Collected', answer: 'Collected editions' },
];

const SEARCH_STATUS = {
  resolving: 'Working out what you\'re after…',
  clarifying: 'One question first ↓',
  loading: 'Building your reading path…',
};

// The search that started this path: the prompt, each clarifying question
// with its answer, then the outcome.
function SearchEntry({ entry, onRetry }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--chat-panel)', border: '1px solid var(--chat-border)' }}>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--chat-text)', marginBottom: 6, whiteSpace: 'pre-wrap' }}>
        {entry.prompt}
      </div>
      {entry.answers.map((a, i) => (
        <div key={i} style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}>
          <div style={{ color: 'var(--chat-muted)' }}>{a.question}</div>
          <div style={{ color: 'var(--chat-text)' }}>→ {a.answer}</div>
        </div>
      ))}
      {entry.note && (
        <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--chat-muted)', marginBottom: 8, paddingLeft: 8, borderLeft: '2px solid var(--chat-accent)' }}>
          {entry.note}
        </div>
      )}
      <div style={{ fontSize: 10, letterSpacing: '0.04em' }}>
        {entry.status === 'done' ? (
          <span style={{ color: 'var(--chat-accent)' }}>{entry.added} {entry.added === 1 ? 'title' : 'titles'} on the map</span>
        ) : entry.status === 'error' ? (
          <span style={{ color: 'var(--chat-warn)' }}>
            {entry.error}{' '}
            {onRetry && <button onClick={onRetry} style={{ ...linkButtonStyle, color: 'var(--chat-accent)' }}>Try again</button>}
          </span>
        ) : (
          <span style={{ color: 'var(--chat-pending)' }}>{SEARCH_STATUS[entry.status]}</span>
        )}
      </div>
    </div>
  );
}

function HistoryEntry({ entry, onReuse }) {
  const status = entry.status === 'asking'
    ? <span style={{ color: 'var(--chat-pending)' }}>Choose a format…</span>
    : entry.status === 'pending'
    ? <span style={{ color: 'var(--chat-pending)' }}>Expanding…</span>
    : entry.status === 'error'
      ? <span style={{ color: 'var(--chat-warn)' }}>{entry.error}</span>
      : <span style={{ color: 'var(--chat-accent)' }}>+{entry.added} {entry.added === 1 ? 'node' : 'nodes'}</span>;

  return (
    <button
      onClick={() => onReuse(entry)}
      title="Reuse this prompt and selection"
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        fontFamily: MONO,
        padding: '10px 12px',
        background: 'var(--chat-panel)',
        border: '1px solid var(--chat-border)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 12, lineHeight: 1.6, color: entry.prompt ? 'var(--chat-text)' : 'var(--chat-muted)', marginBottom: 6, whiteSpace: 'pre-wrap' }}>
        {entry.prompt || '(no prompt)'}
      </div>
      {entry.note && (
        <div style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--chat-muted)', marginBottom: 8, paddingLeft: 8, borderLeft: '2px solid var(--chat-accent)' }}>
          {entry.note}
        </div>
      )}
      <div style={{ fontSize: 10, lineHeight: 1.6, color: 'var(--chat-muted)', marginBottom: 4 }}>
        {entry.source === 'drawer' && <span style={tagStyle}>drawer</span>}
        {entry.format && <span style={tagStyle}>{entry.format}</span>}
        → {entry.nodeTitles.join(', ')}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.04em' }}>{status}</div>
    </button>
  );
}

export function ChatDrawer({
  open, onToggle, nodes, selectedIds, onToggleSelect, onSetSelection, onClearSelection,
  seedNodeIds, focusedNode, history, intro, search, busy, onSend,
  format, onSetFormat, formatQuestion, onAnswerFormat, onCancelFormat,
}) {
  const [prompt, setPrompt] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [history, formatQuestion, search?.question]);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const selectedNodes = [...selectedIds].map((id) => nodeById.get(id)).filter(Boolean);
  const seedNodes = (seedNodeIds || []).map((id) => nodeById.get(id)).filter(Boolean);
  const targetIds = selectedNodes.length > 0
    ? selectedNodes.map((n) => n.id)
    : seedNodes.map((n) => n.id);

  const trimmed = prompt.trim();
  const canSend = !busy && !search && !formatQuestion && targetIds.length > 0 && (trimmed.length > 0 || selectedNodes.length > 0);

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
          border: '1px solid var(--chat-border)', borderLeft: 'none',
          background: 'var(--chat-bg)',
          color: 'var(--chat-muted)',
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
          background: 'var(--chat-bg)',
          borderRight: '1px solid var(--chat-border)',
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
          {intro && !history.some((e) => e.kind === 'clarify') && (
            <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--chat-text)', margin: 0, paddingLeft: 8, borderLeft: '2px solid var(--chat-accent)' }}>
              {intro}
            </p>
          )}
          {history.map((entry) => (entry.kind === 'clarify'
            ? <SearchEntry key={entry.id} entry={entry} onRetry={search?.status === 'error' ? search.onRetry : null} />
            : <HistoryEntry key={entry.id} entry={entry} onReuse={reuse} />))}
          {!search && !history.some((e) => e.kind !== 'clarify') && (
            <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--chat-muted)', margin: 0 }}>
              Ask for more of the path here, e.g. “add the Robin stories” or “focus on crossover events”.
              Shift-click nodes to choose what to expand.
            </p>
          )}
          {search?.question && (
            <ClarifyQuestion question={search.question} onAnswer={search.onAnswer} onCancel={search.onCancel} />
          )}
          {formatQuestion && (
            <div style={{ padding: '10px 12px', background: 'var(--chat-panel)', border: '1px solid var(--chat-accent)' }}>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--chat-text)', marginBottom: 8 }}>
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
                      border: '1px solid var(--chat-accent)',
                      background: 'var(--chat-accent-soft)',
                      color: 'var(--chat-accent)',
                      cursor: 'pointer',
                    }}
                  >
                    {f.answer}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--chat-muted)' }}>
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
              const { color, label } = categoryMeta(n.category);
              return (
                <span key={n.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, padding: '4px 8px',
                  border: `1px solid ${color}`, background: `${color}18`, color,
                  maxWidth: '100%',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>{label}</span>
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
          ) : seedNodes.length > 0 ? (
            <span style={{ fontSize: 11, padding: '4px 8px', border: '1px dashed var(--chat-border)', color: 'var(--chat-muted)' }}>
              {seedNodes.length === 1 ? 'Seed' : 'Seeds'}: {seedNodes.map((n) => n.title).join(', ')}
            </span>
          ) : null}
          {focusedNode && !selectedIds.has(focusedNode.id) && (
            <button
              onClick={() => onToggleSelect(focusedNode.id)}
              style={{
                fontFamily: MONO, fontSize: 11, padding: '4px 8px',
                border: '1px dashed var(--chat-strong-border)', background: 'transparent',
                color: 'var(--chat-text)', cursor: 'pointer',
              }}
            >
              + {focusedNode.title}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 10, color: 'var(--chat-muted)' }}>
          <span>shift-click nodes to select</span>
          {selectedNodes.length > 0 && (
            <button onClick={onClearSelection} style={linkButtonStyle}>Clear</button>
          )}
        </div>

        {/* Format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--chat-muted)' }}>build from</span>
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
                    border: `1px solid ${active ? 'var(--chat-accent)' : 'var(--chat-border)'}`,
                    marginLeft: i === 0 ? 0 : -1,
                    position: 'relative', zIndex: active ? 1 : 0,
                    background: active ? 'var(--chat-accent-soft)' : 'transparent',
                    color: active ? 'var(--chat-accent)' : 'var(--chat-muted)',
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
            background: 'var(--chat-panel)',
            border: '1px solid var(--chat-border)',
            color: 'var(--chat-text)',
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
            border: '1px solid var(--chat-accent)',
            background: 'var(--chat-accent-soft)',
            color: 'var(--chat-accent)',
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
