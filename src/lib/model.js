/* ============================================================
   ComicPath — shared data model: seeds, categories, graph shape
   ============================================================ */

// Bump when the persisted graph / reading-list shape changes; saved data from
// another version is discarded rather than migrated.
export const GRAPH_VERSION = 4;

export const CATEGORIES = ['essential', 'optional', 'skip'];

// Hex values (not CSS vars) because SVG presentation attributes can't read vars.
export const CATEGORY_META = {
  essential: { label: 'Essential', desc: 'Must read — canon for this path', color: '#7c5cfc' },
  optional:  { label: 'Optional',  desc: 'Might read — worth reading, alternate or Elseworlds', color: '#e8a33d' },
  skip:      { label: 'Skip',      desc: 'Not needed — safe to pass on', color: '#7c7c8a' },
};

// Old tier names the model may still produce.
const LEGACY_CATEGORY = {
  canon: 'essential',
  secondary: 'optional',
  elseworld: 'optional',
  elseworlds: 'optional',
  recommended: 'optional',
};

export function normalizeCategory(value, fallback = 'optional') {
  const v = String(value || '').toLowerCase().trim();
  if (CATEGORIES.includes(v)) return v;
  return LEGACY_CATEGORY[v] || fallback;
}

export function categoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.optional;
}

export const SEED_TYPES = ['character', 'group', 'arc'];

export function normalizeSeedType(value) {
  return SEED_TYPES.includes(value) ? value : 'character';
}

export const EDGE_TYPES = ['leads-to', 'prerequisite', 'branches-from', 'crossover', 'prequel'];

// Solid "read first" edges vs dashed "enhances" edges.
export function edgeKind(type) {
  return type === 'leads-to' || type === 'prerequisite' ? 'rec' : 'enh';
}

export function slugify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function normalizeTitle(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function emptyGraph() {
  return { v: GRAPH_VERSION, id: '', seeds: [], nodes: [], edges: [], paths: [], pathNote: '', mode: null };
}

// Reading paths are lettered A, B, C… in seed order.
export const PATH_IDS = ['A', 'B', 'C', 'D'];

// Orders ids so each list keeps its own order, then by any edge between titles
// the lists don't already order, then by year.
export function readingOrder(ids, nodes, edges, lists = []) {
  const inSet = new Set(ids);
  const year = new Map(nodes.map((n, i) => [n.id, (parseInt(n.year, 10) || 9999) * 1000 + i]));
  const listOf = new Map();
  const preds = new Map(ids.map((id) => [id, new Set()]));
  const link = (a, b) => { if (inSet.has(a) && inSet.has(b) && a !== b) preds.get(b).add(a); };
  lists.forEach((list, li) => list.forEach((id, i) => {
    if (!listOf.has(id)) listOf.set(id, li);
    if (i > 0) link(list[i - 1], id);
  }));
  for (const e of edges) {
    if (listOf.has(e.source) && listOf.get(e.source) === listOf.get(e.target)) continue;
    link(e.source, e.target);
  }
  const order = [];
  const left = new Set(ids);
  while (left.size > 0) {
    const ready = [...left].filter((id) => [...preds.get(id)].every((p) => !left.has(p)));
    const next = (ready.length > 0 ? ready : [...left]).sort((a, b) => year.get(a) - year.get(b))[0];
    order.push(next);
    left.delete(next);
  }
  return order;
}

// The seed a path is for: the one it names, else the one most of its titles feature.
export function pathSeedId(path, byId, seeds) {
  if (path.seedId) return path.seedId;
  const count = new Map();
  for (const id of path.nodeIds) for (const sid of byId.get(id)?.seedIds || []) count.set(sid, (count.get(sid) || 0) + 1);
  return (seeds || []).reduce((best, s) => ((count.get(s.id) || 0) > (count.get(best) || 0) ? s.id : best), seeds?.[0]?.id);
}

function defaultPathName(seed) {
  return seed.type === 'arc' ? seed.name : `${seed.name} essentials`;
}

/**
 * One reading path per seed: where to start with that seed, then its
 * essential titles in reading order. candidates are the model's paths as
 * { name, seed, nodeIds }; any that are for the same seed are merged, so one
 * story never splits into two paths. A seed with essential titles but no
 * candidate gets a path through them, and an essential title left off every
 * path joins each of its seeds' paths. Anchors and skip titles never sit on a path.
 */
export function seedPaths(candidates, nodes, edges, seeds) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seedByName = new Map((seeds || []).map((s) => [normalizeTitle(s.name), s.id]));
  const onPath = (id) => byId.has(id) && !byId.get(id).anchor && byId.get(id).category !== 'skip';
  const lists = new Map((seeds || []).map((s) => [s.id, { names: [], lists: [] }]));
  for (const c of candidates) {
    const ids = [...new Set(c.nodeIds)].filter(onPath);
    if (ids.length === 0) continue;
    const seedId = seedByName.get(normalizeTitle(c.seed)) || pathSeedId({ nodeIds: ids }, byId, seeds);
    if (!lists.has(seedId)) continue;
    lists.get(seedId).lists.push(ids);
    if (c.name) lists.get(seedId).names.push(String(c.name));
  }

  const essential = nodes.filter((n) => onPath(n.id) && n.category === 'essential');
  const listed = new Set([...lists.values()].flatMap((l) => l.lists.flat()));
  for (const n of essential) {
    if (listed.has(n.id)) continue;
    for (const sid of n.seedIds || []) lists.get(sid)?.lists.push([n.id]);
  }

  const paths = [];
  for (const seed of seeds || []) {
    const { names, lists: seedLists } = lists.get(seed.id);
    const ids = [...new Set(seedLists.flat())];
    if (!ids.some((id) => byId.get(id).category === 'essential') || paths.length === PATH_IDS.length) continue;
    paths.push({
      id: PATH_IDS[paths.length],
      seedId: seed.id,
      name: names[0] || defaultPathName(seed),
      nodeIds: readingOrder(ids, nodes, edges, seedLists),
    });
  }
  return paths;
}

// Every edge reads source before target, so its label depends on which end it
// is told from: the source leads up to the target, the target directly follows.
export const EDGE_LABELS = { before: 'Leads up to', after: 'Directly follows' };

// Turns any edge the reading paths contradict around, so every arrow points
// in reading order: a path lists its titles in the order they are read.
// Prequel edges are trusted over the paths (see placePrequels).
export function orientEdges(edges, paths) {
  return edges.map((e) => {
    if (e.type === 'prequel') return e;
    const path = (paths || []).find((p) => p.nodeIds.includes(e.source) && p.nodeIds.includes(e.target));
    if (!path || path.nodeIds.indexOf(e.target) > path.nodeIds.indexOf(e.source)) return e;
    return { ...e, source: e.target, target: e.source };
  });
}

// A prequel is published after the story it is set before, so a path in
// publication order lists it too late: move it to just before that story.
export function placePrequels(paths, edges) {
  return paths.map((p) => {
    const ids = [...p.nodeIds];
    for (const e of edges) {
      if (e.type !== 'prequel') continue;
      const from = ids.indexOf(e.source);
      const to = ids.indexOf(e.target);
      if (from < 0 || to < 0 || from < to) continue;
      ids.splice(from, 1);
      ids.splice(to, 0, e.source);
    }
    return { ...p, nodeIds: ids };
  });
}

// A prequel is optional reading: the story it leads into stands on its own.
export function demotePrequels(nodes, edges) {
  const prequels = new Set(edges.filter((e) => e.type === 'prequel').map((e) => e.source));
  return nodes.map((n) => (prequels.has(n.id) && !n.isSeed && n.category === 'essential'
    ? { ...n, category: 'optional' }
    : n));
}

export function seedNodeIds(graph) {
  return graph.nodes.filter((n) => n.isSeed).map((n) => n.id);
}

export function graphTitle(graph) {
  return (graph.seeds || []).map((s) => s.name).join(' + ');
}

// Maps seed names the model returned onto seed ids; unknown names fall back
// to the first seed so every node belongs to at least one seed.
export function resolveSeedIds(names, seeds) {
  const byName = new Map(seeds.map((s) => [normalizeTitle(s.name), s.id]));
  const ids = [...new Set((Array.isArray(names) ? names : [])
    .map((name) => byName.get(normalizeTitle(name)))
    .filter(Boolean))];
  return ids.length > 0 || seeds.length === 0 ? ids : [seeds[0].id];
}

// A title that belongs to more than one seed.
export function isCrossover(node) {
  return !node.isSeed && (node.seedIds?.length || 0) > 1;
}

export function nodeSeeds(node, seeds) {
  return (node.seedIds || []).map((id) => (seeds || []).find((s) => s.id === id)).filter(Boolean);
}

// Every crossover gets an edge from each of its seeds' anchors, and a seed
// anchor nothing points at is linked to the first title of that seed, so no
// seed floats free. Returns the edges with any new ones appended.
export function linkSeeds(nodes, edges) {
  const anchorOf = new Map(nodes.filter((n) => n.isSeed).map((n) => [n.seedIds[0], n.id]));
  const keys = new Set(edges.flatMap((e) => [`${e.source}->${e.target}`, `${e.target}->${e.source}`]));
  const out = [...edges];
  const add = (source, target) => {
    if (!source || !target || source === target || keys.has(`${source}->${target}`)) return;
    keys.add(`${source}->${target}`);
    keys.add(`${target}->${source}`);
    out.push({ source, target, type: 'crossover', kind: edgeKind('crossover'), label: '' });
  };

  for (const n of nodes) {
    if (!isCrossover(n)) continue;
    for (const sid of n.seedIds) add(anchorOf.get(sid), n.id);
  }

  const linked = new Set(out.flatMap((e) => [e.source, e.target]));
  for (const [sid, anchorId] of anchorOf) {
    if (linked.has(anchorId)) continue;
    const first = nodes.find((n) => !n.isSeed && n.seedIds?.includes(sid));
    if (first) add(anchorId, first.id);
  }
  return out;
}
