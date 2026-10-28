import { useState, useCallback } from 'react';
import { GRAPH_VERSION, emptyGraph, graphTitle } from '../lib/model';

const STORAGE_KEY = 'comicpath_path_builder';

// format is null until the reader has said which they want.
const FORMATS = new Set(['issues', 'collected']);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Paths saved under another graph version are dropped, not migrated.
    if (parsed.v !== GRAPH_VERSION || !Array.isArray(parsed.graph?.nodes) || !Array.isArray(parsed.graph?.paths)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      graph: parsed.graph,
      expandedIds: new Set(parsed.expandedIds || []),
      format: FORMATS.has(parsed.format) ? parsed.format : null,
    };
  } catch {
    return null;
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    v: GRAPH_VERSION,
    graph: state.graph,
    expandedIds: [...state.expandedIds],
    format: state.format,
  }));
}

export function usePathBuilder() {
  const [state, setState] = useState(() => {
    return load() || {
      graph: emptyGraph(),
      expandedIds: new Set(),
      format: null,
    };
  });

  const hasSavedPath = state.graph.nodes.length > 0;

  const setGraph = useCallback((graph) => {
    setState((prev) => {
      const next = { ...prev, graph };
      save(next);
      return next;
    });
  }, []);

  const markExpanded = useCallback((nodeId) => {
    setState((prev) => {
      const next = {
        ...prev,
        expandedIds: new Set(prev.expandedIds).add(nodeId),
      };
      save(next);
      return next;
    });
  }, []);

  const setFormat = useCallback((format) => {
    setState((prev) => {
      const next = { ...prev, format };
      save(next);
      return next;
    });
  }, []);

  // Replaces the saved path with a freshly fetched one.
  const start = useCallback((graph) => {
    const next = { graph, expandedIds: new Set(), format: null };
    save(next);
    setState(next);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      graph: emptyGraph(),
      expandedIds: new Set(),
      format: null,
    });
  }, []);

  return {
    graph: state.graph,
    expandedIds: state.expandedIds,
    title: graphTitle(state.graph),
    format: state.format,
    hasSavedPath,
    setGraph,
    markExpanded,
    setFormat,
    start,
    reset,
  };
}
