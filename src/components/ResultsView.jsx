import { useState } from 'react';
import { StorySection } from './StorySection';
import { MetroMap } from './MetroMap';

export function ResultsView({ data, readingList, onReset }) {
  const { character, canonStories, secondaryStories, elseworldsStories, skipStories, aiNote, readingPath } = data;
  const [tab, setTab] = useState('guide');
  const hasPath = readingPath && readingPath.mainLine?.length > 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px 60px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)' }}>
        <button
          onClick={onReset}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-canon)',
            fontSize: 'var(--font-size-sm)',
            padding: 0,
          }}
        >
          ← Search
        </button>
        <span style={{ margin: '0 6px' }}>›</span>
        <span>{character.name}</span>
      </div>

      {/* Character header */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-lg)',
        marginBottom: 'var(--space-lg)',
        display: 'flex',
        gap: 'var(--space-md)',
        alignItems: 'flex-start',
      }}>
        <div style={{
          width: 52, height: 52,
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(124,92,252,0.15)',
          border: '1px solid var(--color-canon)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 20, color: 'var(--color-canon)',
          flexShrink: 0,
        }}>
          {character.initials ?? character.name.slice(0, 2).toUpperCase()}
        </div>

        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 4 }}>
            {character.name}
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)', marginBottom: 8 }}>
            {[character.publisher, character.firstAppearance && `First appeared ${character.firstAppearance}`].filter(Boolean).join(' · ')}
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>
            {character.description}
          </p>
          {character.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {character.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 20,
                    color: 'var(--color-muted)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI curator note */}
      {aiNote && (
        <div style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-muted)',
          lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--color-canon)', marginRight: 8 }}>✦</span>
          {aiNote}
        </div>
      )}

      {/* Tab toggle */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 'var(--space-lg)',
        borderRadius: 'var(--radius-sm)', overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}>
        {[
          { key: 'guide', label: 'Guide' },
          { key: 'path', label: 'Reading Path', disabled: !hasPath },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setTab(t.key)}
            disabled={t.disabled}
            style={{
              flex: 1, padding: '9px 4px', border: 'none',
              background: tab === t.key ? 'var(--color-canon)' : 'var(--color-surface)',
              color: t.disabled ? 'var(--color-border)' : tab === t.key ? '#fff' : 'var(--color-muted)',
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              cursor: t.disabled ? 'default' : 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'guide' && (
        <>
          <StorySection type="canon"     stories={canonStories}     character={character.name} readingList={readingList} />
          <StorySection type="secondary" stories={secondaryStories} character={character.name} readingList={readingList} />
          <StorySection type="elseworld" stories={elseworldsStories} character={character.name} readingList={readingList} />
          <StorySection type="skip"      stories={skipStories}      character={character.name} readingList={readingList} />
        </>
      )}

      {tab === 'path' && hasPath && (
        <MetroMap readingPath={readingPath} readingList={readingList} character={character.name} />
      )}

      {tab === 'path' && !hasPath && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-muted)', fontSize: 13 }}>
          No reading path available for this search. Try a different mode or character.
        </div>
      )}
    </div>
  );
}
