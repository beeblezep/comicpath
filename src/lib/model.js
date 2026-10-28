/* ============================================================
   ComicPath — shared data model: seeds, categories, graph shape
   ============================================================ */

// Bump when the persisted graph / reading-list shape changes; saved data from
// another version is discarded rather than migrated.
export const GRAPH_VERSION = 2;

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

export const EDGE_TYPES = ['leads-to', 'prerequisite', 'branches-from', 'crossover'];

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
  return { v: GRAPH_VERSION, seeds: [], nodes: [], edges: [], pathNote: '', mode: null };
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
