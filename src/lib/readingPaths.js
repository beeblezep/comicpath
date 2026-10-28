/* ============================================================
   Reading paths — what the map shows and in what order, given
   the graph and the reader's changes (skips, adds, removals).
   Pure functions; useMapState holds the state, map/* renders.
   ============================================================ */

import { EDGE_LABELS, categoryMeta, nodeSeeds } from './model.js';

// Titles not drawn on the map: synthetic seed anchors (the seed's region
// stands for them), titles under a collapsed expansion, and — unless the
// reader asked to see them — skip-category and removed titles.
export function hiddenIds(graph, state) {
  const hidden = new Set();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const collapsedUnder = (n, seen = new Set()) => (n.fromIds || []).some((id) => {
    if (state.collapsed[id]) return true;
    const parent = byId.get(id);
    if (!parent || seen.has(id)) return false;
    seen.add(id);
    return collapsedUnder(parent, seen);
  });
  for (const n of graph.nodes) {
    if (n.anchor) hidden.add(n.id);
    else if (collapsedUnder(n)) hidden.add(n.id);
    else if (!state.showSkipped && (n.category === 'skip' || state.removed[n.id])) hidden.add(n.id);
  }
  return hidden;
}

// A path's titles as the reader currently has them: essential titles plus
// optional ones they added, minus anything hidden. Skipped titles stay in
// the list (the line routes around them); `kept` drops them.
export function pathCards(path, byId, state, hidden) {
  return path.nodeIds.filter((id) => {
    const n = byId.get(id);
    return n && !hidden.has(id) && (n.category === 'essential' || state.adds[id]);
  });
}

export function keptCards(cards, state) {
  return cards.filter((id) => !state.skip[id]);
}

export function pathChanged(path, byId, state) {
  return path.nodeIds.some((id) => (byId.get(id)?.category === 'optional' ? state.adds[id] : state.skip[id]));
}

// What + / − does to a title: optional titles on a path are added or taken
// off it, other titles on a path are skipped or put back, and titles on no
// path are removed from the map or restored.
export function toggleKind(node, paths) {
  const onPath = paths.some((p) => p.nodeIds.includes(node.id));
  if (!onPath) return 'removed';
  return node.category === 'optional' ? 'adds' : 'skip';
}

export function isIn(node, paths, state) {
  const kind = toggleKind(node, paths);
  return kind === 'adds' ? !!state.adds[node.id] : !state[kind][node.id];
}

// Titles to read before / after a title, from the visible connectors.
export function relations(nodeId, edges) {
  const collect = (dir) => {
    const map = new Map();
    for (const e of edges) {
      const other = dir === 'before' ? (e.target === nodeId ? e.source : null) : (e.source === nodeId ? e.target : null);
      if (!other) continue;
      if (!map.has(other)) map.set(other, new Set());
      map.get(other).add(e.kind);
    }
    return [...map].map(([id, kinds]) => ({ id, kinds: [...kinds] }));
  };
  return { before: collect('before'), after: collect('after') };
}

const titleOf = (byId, id) => byId.get(id)?.title || '';

export function summaryText({ active, paths, cardsByPath, byId, state, sel, edges }) {
  if (active.length > 0) {
    const seq = [];
    for (const key of active) for (const id of cardsByPath[key]) if (!seq.includes(id)) seq.push(id);
    const kept = seq.filter((id) => !state.skip[id]);
    const skipped = seq.filter((id) => state.skip[id]);
    const name = active.length > 1
      ? `Reading paths ${active.join(' + ')}`
      : paths.find((p) => p.id === active[0])?.name || `Reading path ${active[0]}`;
    return `${name} · ${kept.map((id) => titleOf(byId, id)).join(' → ')}`
      + (skipped.length ? ` · Skipping ${skipped.map((id) => titleOf(byId, id)).join(', ')}` : '')
      + (Object.values(state.pins).some(Boolean) ? ' · Use − or + on a title to change your path' : '');
  }
  if (!sel) return 'Select a title to see what to read before and after it, or hover a reading path to trace it.';
  const { before, after } = relations(sel, edges);
  if (before.length === 0 && after.length === 0) {
    return `${titleOf(byId, sel)} is a standalone story, with no reading order around it.`;
  }
  const list = (items) => (items.length === 0 ? 'nothing' : items
    .map((r) => titleOf(byId, r.id) + (r.kinds.includes('rec') ? '' : ' (optional)')).join(', '));
  return `${titleOf(byId, sel)} · Read before: ${list(before)} · Read after: ${list(after)}`;
}

// Rows for the reading view: a header per path, then its kept titles in
// order, each with how it relates to the one before.
export function readingRows({ keys, paths, cardsByPath, byId, state, edges, seeds }) {
  const rows = [];
  let step = 0;
  for (const key of keys) {
    const path = paths.find((p) => p.id === key);
    const cards = cardsByPath[key] || [];
    const kept = keptCards(cards, state);
    rows.push({ kind: 'header', key, label: path?.name || `Reading path ${key}`, count: kept.length });
    if (kept.length === 0) rows.push({ kind: 'empty', key });
    kept.forEach((id, i) => {
      step += 1;
      const prev = i > 0 ? kept[i - 1] : null;
      let rel = '';
      if (prev) {
        const kinds = [...new Set(edges.filter((e) => e.source === prev && e.target === id).map((e) => e.kind))];
        const phrases = kinds.map((k) => (k === 'rec'
          ? `${EDGE_LABELS.rec} ${titleOf(byId, prev)}`
          : `${titleOf(byId, prev)} leads up to this`));
        const gap = cards.slice(cards.indexOf(prev) + 1, cards.indexOf(id));
        rel = (phrases.length ? phrases.join(' · ') : `Next after ${titleOf(byId, prev)}`)
          + (gap.length ? ` · skipping ${gap.map((g) => titleOf(byId, g)).join(', ')}` : '');
      }
      const node = byId.get(id);
      const meta = [
        categoryMeta(node.category).label,
        nodeSeeds(node, seeds).map((s) => s.name).join(' + '),
        state.adds[id] ? 'Your addition' : null,
      ].filter(Boolean).join(' · ');
      rows.push({ kind: 'item', key: `${key}-${id}`, id, n: step, title: node.title, meta, rel, last: i === kept.length - 1 });
    });
  }
  return rows;
}
