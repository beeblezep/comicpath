import { useState, useCallback } from 'react';
import { usePathBuilder } from '../hooks/usePathBuilder';
import { fetchRelatedTitles } from '../lib/api';
import { mergeExpansion } from '../lib/graphMerge';
import { TitleSearchPanel } from './TitleSearchPanel';
import { ConstellationMap } from './ConstellationMap';

const MONO = "'SF Mono', Menlo, Consolas, monospace";

const PHASE = { SEARCH: 'search', BUILDING: 'building' };

export function PathBuilder({ readingList, alreadyRead, onReset, initialQuery }) {
  const pb = usePathBuilder();
  const [phase, setPhase] = useState(pb.hasSavedPath ? PHASE.BUILDING : PHASE.SEARCH);
  const [expandingId, setExpandingId] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const handleSelect = useCallback((result) => {
    const seedNode = {
      id: 'n1',
      title: result.name,
      year: result.year || '',
      issues: result.issueCount ? `${result.issueCount} issues` : '',
      why: 'Your starting point.',
      tier: 'essential',
      weight: 5,
      tags: ['seed'],
    };
    pb.setGraph({
      targetTitle: result.name,
      nodes: [seedNode],
      edges: [],
      pathNote: '',
    });
    pb.setSeedTitle(result.name);
    setPhase(PHASE.BUILDING);
  }, [pb]);

  const handleExpand = useCallback(async (nodeId) => {
    const node = pb.graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setExpandingId(nodeId);
    try {
      const existingTitles = pb.graph.nodes.map((n) => n.title);
      const { relatedNodes, edges } = await fetchRelatedTitles(node.title, existingTitles);

      const { graph: merged } = mergeExpansion(pb.graph, nodeId, relatedNodes, edges);
      pb.setGraph(merged);
      pb.markExpanded(nodeId);
    } catch (err) {
      showToast(err.message || 'Failed to expand. Try again.');
    } finally {
      setExpandingId(null);
    }
  }, [pb]);

  const handleClose = useCallback(() => {
    onReset();
  }, [onReset]);

  const handleStartNew = useCallback(() => {
    pb.reset();
    setPhase(PHASE.SEARCH);
  }, [pb]);

  if (phase === PHASE.SEARCH) {
    return (
      <div>
        {pb.hasSavedPath && (
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 20px 0' }}>
            <button
              onClick={() => setPhase(PHASE.BUILDING)}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'rgba(124,92,252,0.1)',
                border: '1px solid rgba(124,92,252,0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#7c5cfc',
                fontFamily: MONO, fontSize: 12, letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>Resume: {pb.seedTitle || 'Saved path'}</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>{pb.graph.nodes.length} nodes →</span>
            </button>
          </div>
        )}
        <TitleSearchPanel onSelect={handleSelect} initialQuery={initialQuery} />
      </div>
    );
  }

  return (
    <>
      <ConstellationMap
        graph={pb.graph}
        readingList={readingList}
        alreadyRead={alreadyRead}
        character={null}
        onClose={handleClose}
        onExpand={handleExpand}
        expandedIds={pb.expandedIds}
        expandingId={expandingId}
        title={pb.seedTitle || 'Reading Path'}
      />

      {/* New Path button — top area, left of back */}
      <button
        onClick={handleStartNew}
        style={{
          position: 'fixed', top: 24, left: 34,
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '8px 18px', marginTop: 24,
          border: '1px solid #2a2b38',
          background: 'rgba(8,8,13,0.8)',
          color: '#7c7c8a',
          cursor: 'pointer',
          zIndex: 115,
        }}
      >
        New Path
      </button>

      {/* Toast overlay */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 24px',
          background: 'rgba(220,60,60,0.9)',
          color: '#fff',
          fontFamily: MONO, fontSize: 12,
          borderRadius: 6,
          zIndex: 200,
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
