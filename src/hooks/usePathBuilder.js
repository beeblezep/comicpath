import { useState, useCallback } from 'react';

const STORAGE_KEY = 'comicpath_path_builder';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.graph || !Array.isArray(parsed.graph.nodes)) return null;
    return {
      graph: parsed.graph,
      expandedIds: new Set(parsed.expandedIds || []),
      seedTitle: parsed.seedTitle || '',
    };
  } catch {
    return null;
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    graph: state.graph,
    expandedIds: [...state.expandedIds],
    seedTitle: state.seedTitle,
  }));
}

export function usePathBuilder() {
  const [state, setState] = useState(() => {
    return load() || {
      graph: { nodes: [], edges: [], targetTitle: null, pathNote: '' },
      expandedIds: new Set(),
      seedTitle: '',
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

  const setSeedTitle = useCallback((seedTitle) => {
    setState((prev) => {
      const next = { ...prev, seedTitle };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      graph: { nodes: [], edges: [], targetTitle: null, pathNote: '' },
      expandedIds: new Set(),
      seedTitle: '',
    });
  }, []);

  return {
    graph: state.graph,
    expandedIds: state.expandedIds,
    seedTitle: state.seedTitle,
    hasSavedPath,
    setGraph,
    markExpanded,
    setSeedTitle,
    reset,
  };
}
