import { useState, useMemo, useRef } from 'react';
import { computeLayout } from '../lib/metroLayout';
import { MetroMapNode } from './MetroMapNode';
import { MetroMapTooltip } from './MetroMapTooltip';

const MODE_LABELS = { full: 'Full Guide', 'catch-up': 'Catch Up', 'deep-dive': 'Deep Dive' };

export function MetroMap({ readingPath, readingList, character }) {
  const [selectedId, setSelectedId] = useState(null);
  const containerRef = useRef(null);

  const { nodes, lines, width, height } = useMemo(
    () => computeLayout(readingPath.mainLine),
    [readingPath.mainLine],
  );

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;

  function handleNodeClick(node) {
    setSelectedId(selectedId === node.id ? null : node.id);
  }

  function handleSaveToggle() {
    if (!selectedNode) return;
    const story = {
      title: selectedNode.title,
      year: selectedNode.year,
      issues: selectedNode.issues,
      why: selectedNode.why,
      character,
    };
    readingList.toggle(story);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{
          fontSize: 10, padding: '3px 10px',
          borderRadius: 20, fontWeight: 600,
          background: 'rgba(124,92,252,0.15)',
          color: 'var(--color-canon)',
        }}>
          {MODE_LABELS[readingPath.mode] || readingPath.mode}
        </span>
        {readingPath.pathNote && (
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {readingPath.pathNote}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        {[
          { color: 'var(--color-tier-essential)', label: 'Essential' },
          { color: 'var(--color-tier-recommended)', label: 'Recommended' },
          { color: 'var(--color-tier-optional)', label: 'Optional' },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: l.color }} />
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ display: 'block' }}
        onClick={(e) => { if (e.target.tagName === 'svg') setSelectedId(null); }}
      >
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.isMain ? 'var(--color-canon)' : 'var(--color-muted)'}
            strokeWidth={l.isMain ? 3 : 1.5}
            strokeDasharray={l.dashed ? '6 4' : 'none'}
            opacity={l.isMain ? 0.7 : 0.4}
          />
        ))}
        {nodes.map((n) => (
          <MetroMapNode
            key={n.id}
            node={n}
            selected={selectedId === n.id}
            onClick={handleNodeClick}
          />
        ))}
      </svg>

      {selectedNode && (
        <MetroMapTooltip
          node={selectedNode}
          onClose={() => setSelectedId(null)}
          isSaved={readingList.has(selectedNode.title)}
          onToggleSave={handleSaveToggle}
          containerRef={containerRef}
        />
      )}
    </div>
  );
}
