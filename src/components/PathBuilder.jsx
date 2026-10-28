import { useState, useCallback, useRef } from 'react';
import { fetchRelatedTitles } from '../lib/api';
import { GRAPH_VERSION } from '../lib/model';
import { mergeExpansion } from '../lib/graphMerge';
import { detectFormat } from '../lib/formatIntent';
import { TitleSearchPanel } from './TitleSearchPanel';
import { ConstellationMap } from './ConstellationMap';

const MONO = "'SF Mono', Menlo, Consolas, monospace";

const PHASE = { SEARCH: 'search', BUILDING: 'building' };

export function PathBuilder({ pathBuilder: pb, readingList, alreadyRead, onReset, initialQuery, history }) {
  const [phase, setPhase] = useState(pb.hasSavedPath ? PHASE.BUILDING : PHASE.SEARCH);
  const [expandingIds, setExpandingIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  // The expansion waiting on the reader's issues-or-collected answer, if any.
  const [formatQuestion, setFormatQuestion] = useState(null);

  // Latest graph, so an expansion that finishes after another merges into
  // the up-to-date graph instead of the one captured when it started.
  const graphRef = useRef(pb.graph);
  graphRef.current = pb.graph;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  // A picked series or story arc becomes a single title seed. (Series map to
  // "arc" for now; the search-based seed picker goes away with intent resolution.)
  const handleSelect = useCallback((result) => {
    const seed = { id: 's1', name: result.name, type: 'arc' };
    const seedNode = {
      id: 'n1',
      title: result.name,
      year: result.year || '',
      issues: result.issueCount ? `${result.issueCount} issues` : '',
      why: 'Your starting point.',
      category: 'essential',
      seedIds: [seed.id],
      weight: 5,
      tags: ['seed'],
      isSeed: true,
    };
    pb.setGraph({
      v: GRAPH_VERSION,
      seeds: [seed],
      nodes: [seedNode],
      edges: [],
      pathNote: '',
      mode: null,
    });
    setPhase(PHASE.BUILDING);
  }, [pb]);

  const runExpansion = useCallback(async (nodes, refinementPrompt, format, entryId) => {
    const ids = nodes.map((n) => n.id);
    setExpandingIds((prev) => new Set([...prev, ...ids]));
    try {
      const existingTitles = graphRef.current.nodes.map((n) => n.title);
      const { relatedNodes, edges, note } = await fetchRelatedTitles(
        nodes.map((n) => n.title), existingTitles, refinementPrompt, format, graphRef.current.seeds,
      );

      const { graph: merged, newNodeIds } = mergeExpansion(graphRef.current, ids, relatedNodes, edges);
      graphRef.current = merged;
      pb.setGraph(merged);
      ids.forEach((id) => pb.markExpanded(id));
      history.update(entryId, { status: 'done', added: newNodeIds.length, note });
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

  const findNodes = (nodeIds) => nodeIds
    .map((id) => graphRef.current.nodes.find((n) => n.id === id))
    .filter(Boolean);

  const handleExpandMany = useCallback((nodeIds, refinementPrompt, source = 'chat') => {
    const nodes = findNodes(nodeIds);
    if (nodes.length === 0) return;

    // A format named in the prompt wins for this request; otherwise use the
    // path's saved preference, and ask in the chat if there isn't one yet.
    const named = detectFormat(refinementPrompt);
    const format = named || pb.format;

    // A new request replaces one still waiting on the format question.
    if (formatQuestion) history.remove(formatQuestion.entryId);

    const ids = nodes.map((n) => n.id);
    const entryId = history.add({
      prompt: refinementPrompt || '',
      nodeIds: ids,
      nodeTitles: nodes.map((n) => n.title),
      source,
      format,
      status: format ? 'pending' : 'asking',
    });

    if (!format) {
      setFormatQuestion({ entryId, nodeIds: ids, prompt: refinementPrompt || '' });
      return;
    }
    setFormatQuestion(null);
    if (!pb.format) pb.setFormat(format);
    return runExpansion(nodes, refinementPrompt, format, entryId);
  }, [pb, history, formatQuestion, runExpansion]);

  const handleAnswerFormat = useCallback((format) => {
    if (!formatQuestion) return;
    setFormatQuestion(null);
    pb.setFormat(format);
    const nodes = findNodes(formatQuestion.nodeIds);
    if (nodes.length === 0) {
      history.remove(formatQuestion.entryId);
      return;
    }
    history.update(formatQuestion.entryId, { status: 'pending', format });
    runExpansion(nodes, formatQuestion.prompt, format, formatQuestion.entryId);
  }, [pb, history, formatQuestion, runExpansion]);

  const handleCancelFormat = useCallback(() => {
    if (!formatQuestion) return;
    history.remove(formatQuestion.entryId);
    setFormatQuestion(null);
  }, [history, formatQuestion]);

  const handleExpand = useCallback((nodeId, refinementPrompt) => {
    return handleExpandMany([nodeId], refinementPrompt, 'drawer');
  }, [handleExpandMany]);

  const handleClose = useCallback(() => {
    onReset();
  }, [onReset]);

  const handleStartNew = useCallback(() => {
    pb.reset();
    history.clear();
    setFormatQuestion(null);
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
              <span>Resume: {pb.title || 'Saved path'}</span>
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
        format={pb.format}
        onSetFormat={pb.setFormat}
        formatQuestion={formatQuestion}
        onAnswerFormat={handleAnswerFormat}
        onCancelFormat={handleCancelFormat}
        onNewPath={handleStartNew}
        title={pb.title || 'Reading Path'}
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
