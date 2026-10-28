import { useState, useCallback, useEffect, useRef } from 'react';
import { GRAPH_VERSION } from '../lib/model';
import { toggleKind } from '../lib/readingPaths';

const STORAGE_KEY = 'comicpath_map_state';

// The reader's changes to a path (skips, adds, removals, collapsed
// expansions) are saved per graph; selection, hover and pins are not.
const EMPTY_CHANGES = { skip: {}, adds: {}, removed: {}, collapsed: {} };

function load(graphId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || parsed.v !== GRAPH_VERSION) return { changes: EMPTY_CHANGES, showSkipped: false };
    return {
      changes: parsed.graphId === graphId ? { ...EMPTY_CHANGES, ...parsed.changes } : EMPTY_CHANGES,
      showSkipped: !!parsed.showSkipped,
    };
  } catch {
    return { changes: EMPTY_CHANGES, showSkipped: false };
  }
}

/**
 * sel: selected title · hover / pins: traced and pinned paths · info: title
 * in the details drawer · rv: reading view open · chatIds: titles picked for
 * the chat (shift-click) · showSkipped: draw skipped and removed titles.
 */
export function useMapState(graph) {
  const [saved] = useState(() => load(graph.id));
  const [changes, setChanges] = useState(saved.changes);
  const [showSkipped, setShowSkipped] = useState(saved.showSkipped);
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  const [pins, setPins] = useState({});
  const [info, setInfo] = useState(null);
  const [rv, setRv] = useState(false);
  const [chatIds, setChatIds] = useState(new Set());
  const leaveTimer = useRef(null);

  // A different graph (new search) starts from its own saved changes.
  const graphIdRef = useRef(graph.id);
  useEffect(() => {
    if (graphIdRef.current === graph.id) return;
    graphIdRef.current = graph.id;
    setChanges(load(graph.id).changes);
    setSel(null); setHover(null); setPins({}); setInfo(null); setRv(false); setChatIds(new Set());
  }, [graph.id]);

  useEffect(() => {
    if (!graph.id) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: GRAPH_VERSION, graphId: graph.id, changes, showSkipped }));
    } catch { /* storage full or blocked: changes just aren't kept */ }
  }, [graph.id, changes, showSkipped]);

  const flip = useCallback((kind, id) => {
    setChanges((prev) => ({ ...prev, [kind]: { ...prev[kind], [id]: !prev[kind][id] } }));
  }, []);

  // + / − on a title: add or skip it on its path, or remove it from the map.
  const toggleIn = useCallback((node) => {
    flip(toggleKind(node, graph.paths || []), node.id);
  }, [flip, graph.paths]);

  const toggleCollapsed = useCallback((id) => flip('collapsed', id), [flip]);

  const resetPath = useCallback((path) => {
    setChanges((prev) => {
      const skip = { ...prev.skip };
      const adds = { ...prev.adds };
      for (const id of path.nodeIds) { delete skip[id]; delete adds[id]; }
      return { ...prev, skip, adds };
    });
  }, []);

  const hoverPath = useCallback((key) => {
    clearTimeout(leaveTimer.current);
    setHover(key);
  }, []);

  const leavePath = useCallback(() => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHover(null), 120);
  }, []);

  const togglePin = useCallback((key) => {
    setPins((prev) => ({ ...prev, [key]: !prev[key] }));
    setSel(null);
  }, []);

  const pinOnly = useCallback((keys) => {
    clearTimeout(leaveTimer.current);
    setPins(Object.fromEntries(keys.map((k) => [k, true])));
    setHover(null);
    setSel(null);
  }, []);

  const select = useCallback((id) => {
    setSel((prev) => (prev === id ? null : id));
    setPins({});
  }, []);

  const toggleChat = useCallback((id) => {
    setChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    clearTimeout(leaveTimer.current);
    setSel(null); setPins({}); setHover(null); setInfo(null);
  }, []);

  return {
    ...changes, showSkipped, sel, hover, pins, info, rv, chatIds,
    setShowSkipped, setInfo, setRv, setChatIds, setSel, setPins, setHover,
    toggleIn, toggleCollapsed, resetPath, hoverPath, leavePath, togglePin, pinOnly, select, toggleChat, clearAll,
  };
}
