import { useState, useEffect } from 'react';

// A multiple-choice clarifying question; "Other" is always offered for a free-text answer.
export function ClarifyQuestion({ question, onAnswer, onCancel, busy }) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState('');

  useEffect(() => {
    setOtherOpen(false);
    setOther('');
  }, [question]);

  function submitOther() {
    const text = other.trim();
    if (text) onAnswer(text);
  }

  return (
    <div style={{
      border: '1px solid var(--color-accent)',
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-md)',
      background: 'var(--color-surface)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 'var(--space-sm)' }}>{question.text}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {question.options.map((o) => (
          <button
            key={o.id}
            onClick={() => onAnswer(o.label)}
            disabled={busy}
            style={{
              textAlign: 'left',
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {o.label}
            {o.hint && <span style={{ color: 'var(--color-muted)' }}> — {o.hint}</span>}
          </button>
        ))}

        {otherOpen ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitOther()}
              placeholder="Type your answer…"
              disabled={busy}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-size-sm)',
              }}
            />
            <button
              onClick={submitOther}
              disabled={busy || !other.trim()}
              style={{
                padding: '8px 14px',
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: 'var(--font-size-sm)',
                opacity: busy || !other.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOtherOpen(true)}
            disabled={busy}
            style={{
              textAlign: 'left',
              padding: '8px 12px',
              background: 'transparent',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-muted)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Other…
          </button>
        )}
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            marginTop: 'var(--space-sm)',
            background: 'none', border: 'none', padding: 0,
            color: 'var(--color-muted)', fontSize: 12,
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
