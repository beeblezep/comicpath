import { useState, useEffect } from 'react';
import { categoryMeta, isCrossover, nodeSeeds, slugify } from '../lib/model';

const MONO = "'SF Mono', Menlo, Consolas, monospace";

const chipStyle = {
  fontFamily: MONO,
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  border: '1px solid #2a2b38', padding: '4px 8px', color: '#7c7c8a',
};

export function ConstellationDetail({ node, seeds, open, readingList, alreadyRead, character, onToggleRead, onHide, onClose, nodeIndex, totalNodes, onExpand, expandable, expanding }) {
  const { color, label } = node ? categoryMeta(node.category) : { color: '#7c7c8a', label: '' };
  const slug = node ? slugify(node.title) : '';

  const isRead = node ? alreadyRead.isRead(slug) : false;
  const isSaved = node ? readingList.has(slug) : false;
  const ownSeeds = node ? nodeSeeds(node, seeds) : [];

  const [refinement, setRefinement] = useState('');
  useEffect(() => { setRefinement(''); }, [node?.id]);

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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <span style={{ ...chipStyle, borderColor: color, background: `${color}18`, color }}>{label}</span>
            {node.isSeed && (
              <span style={{ ...chipStyle, borderColor: '#eae7de', color: '#eae7de' }}>
                Seed · {ownSeeds[0]?.type || 'character'}
              </span>
            )}
            {isCrossover(node) && <span style={chipStyle}>Crossover</span>}
          </div>

          <p style={{ fontFamily: MONO, fontSize: 13, color: '#7c7c8a', margin: '0 0 22px' }}>
            {[node.year, node.edition].filter(Boolean).join(' · ')}
            {!node.isSeed && ownSeeds.length > 0 && (
              <span style={{ display: 'block', marginTop: 6 }}>
                {ownSeeds.length === 1 ? 'Seed' : 'Seeds'}: {ownSeeds.map((s) => s.name).join(', ')}
              </span>
            )}
          </p>

          <div style={{ width: '100%', height: 3, background: color, marginBottom: 22 }} />

          {node.edition && node.collects?.length > 0 ? (
            <div style={{ fontFamily: MONO, fontSize: 12, color: '#7c7c8a', margin: '0 0 16px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Collects
              </div>
              {node.collects.map((c, i) => (
                <div key={i} style={{ lineHeight: 1.7 }}>
                  {c.issues}{c.issues && c.story ? ' · ' : ''}<span style={{ color: '#c9c7bd' }}>{c.story}</span>
                </div>
              ))}
            </div>
          ) : node.issues && (
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
              <>
                {!expanding && (
                  <textarea
                    value={refinement}
                    onChange={(e) => setRefinement(e.target.value)}
                    placeholder={expandable
                      ? "e.g. focus on Lazarus Planet, include Superman…"
                      : "e.g. now include Robin stories, add crossover events…"}
                    rows={2}
                    style={{
                      width: '100%', fontFamily: MONO,
                      fontSize: 12, lineHeight: 1.6,
                      padding: '8px 10px', marginBottom: 4,
                      background: '#14141d',
                      border: '1px solid #2a2b38',
                      color: '#c9c7bd',
                      resize: 'vertical',
                      minHeight: 48, maxHeight: 120,
                      boxSizing: 'border-box',
                    }}
                  />
                )}
                <button
                  onClick={() => {
                    if (!expanding) {
                      onExpand(node.id, refinement);
                      setRefinement('');
                    }
                  }}
                  disabled={expanding}
                  style={{
                    width: '100%', fontFamily: MONO,
                    fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '10px 14px', marginBottom: 4,
                    border: `1px solid ${expandable ? color : '#3a3b48'}`,
                    background: expandable ? `${color}22` : 'rgba(58,59,72,0.15)',
                    color: expandable ? color : '#8a8a97',
                    cursor: expanding ? 'default' : 'pointer',
                    opacity: expanding ? 0.6 : 1,
                  }}
                >
                  {expanding ? 'Expanding…' : expandable ? '+ Expand' : '+ Expand again'}
                </button>
              </>
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
                  category: node.category,
                  format: node.issues || '',
                  subject: character,
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
