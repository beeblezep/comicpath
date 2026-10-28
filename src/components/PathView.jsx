import { useState, useCallback, useRef } from 'react';
import { fetchRelatedTitles } from '../lib/api';
import { mergeExpansion } from '../lib/graphMerge';
import { detectFormat } from '../lib/formatIntent';
import { emptyGraph } from '../lib/model';
import { MetroMap } from './map/MetroMap';

const MONO = "'SF Mono', Menlo, Consolas, monospace";

const PENDING_GRAPH = emptyGraph();

const PLACEHOLDER = {
  resolving: 'Working out what you\'re after…',
  clarifying: 'Answer the question in the chat to start your path',
  loading: 'Building your reading path…',
  error: 'Something went wrong — see the chat',
};

// The canvas + chat drawer for the current reading path. While a new search is
// still being resolved or built (`search` set), the canvas is empty and the
// chat carries the clarifying questions.
export function PathView({ pathBuilder: pb, readingList, alreadyRead, onReset, history, search }) {
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
      kind: 'expand',
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
    onReset();
  }, [pb, history, onReset]);

  return (
    <>
      <MetroMap
        graph={search ? PENDING_GRAPH : pb.graph}
        readingList={readingList}
        alreadyRead={alreadyRead}
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
        title={search ? search.prompt : pb.title || 'Reading Path'}
        intro={search ? null : pb.graph.note}
        placeholder={search ? PLACEHOLDER[search.status] : null}
        search={search}
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
