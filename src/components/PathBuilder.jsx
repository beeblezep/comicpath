import { useState, useCallback, useRef } from 'react';
import { usePathBuilder } from '../hooks/usePathBuilder';
import { fetchRelatedTitles } from '../lib/api';
import { mergeExpansion } from '../lib/graphMerge';
import { TitleSearchPanel } from './TitleSearchPanel';
import { ConstellationMap } from './ConstellationMap';

const MONO = "'SF Mono', Menlo, Consolas, monospace";

const PHASE = { SEARCH: 'search', BUILDING: 'building' };

export function PathBuilder({ readingList, alreadyRead, onReset, initialQuery, history }) {
  const pb = usePathBuilder();
  const [phase, setPhase] = useState(pb.hasSavedPath ? PHASE.BUILDING : PHASE.SEARCH);
  const [expandingIds, setExpandingIds] = useState(new Set());
  const [toast, setToast] = useState(null);

  // Latest graph, so an expansion that finishes after another merges into
  // the up-to-date graph instead of the one captured when it started.
  const graphRef = useRef(pb.graph);
  graphRef.current = pb.graph;

  const seedNodeId = (pb.graph.nodes.find((n) => n.tags?.includes('seed')) || pb.graph.nodes[0])?.id || null;

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

  const handleExpandMany = useCallback(async (nodeIds, refinementPrompt, source = 'chat') => {
    const nodes = nodeIds
      .map((id) => graphRef.current.nodes.find((n) => n.id === id))
      .filter(Boolean);
    if (nodes.length === 0) return;

    const ids = nodes.map((n) => n.id);
    const entryId = history.add({
      prompt: refinementPrompt || '',
      nodeIds: ids,
      nodeTitles: nodes.map((n) => n.title),
      source,
      status: 'pending',
    });

    setExpandingIds((prev) => new Set([...prev, ...ids]));
    try {
      const existingTitles = graphRef.current.nodes.map((n) => n.title);
      const { relatedNodes, edges } = await fetchRelatedTitles(nodes.map((n) => n.title), existingTitles, refinementPrompt);

      const { graph: merged, newNodeIds } = mergeExpansion(graphRef.current, ids[0], relatedNodes, edges);
      graphRef.current = merged;
      pb.setGraph(merged);
      ids.forEach((id) => pb.markExpanded(id));
      history.update(entryId, { status: 'done', added: newNodeIds.length });
    } catch (err) {
      const msg = err.message || 'Failed to expand. Try again.';
      history.update(entryId, { status: 'error', error: msg });
      showToast(msg);
    } finally {
      setExpandingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [pb, history]);

  const handleExpand = useCallback((nodeId, refinementPrompt) => {
    return handleExpandMany([nodeId], refinementPrompt, 'drawer');
  }, [handleExpandMany]);

  const handleClose = useCallback(() => {
    onReset();
  }, [onReset]);

  const handleStartNew = useCallback(() => {
    pb.reset();
    history.clear();
    setPhase(PHASE.SEARCH);
  }, [pb, history]);

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
        onExpandMany={handleExpandMany}
        expandedIds={pb.expandedIds}
        expandingIds={expandingIds}
        history={history.entries}
        seedNodeId={seedNodeId}
        onNewPath={handleStartNew}
        title={pb.seedTitle || 'Reading Path'}
      />

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
