/* ============================================================
   Metro layout — a deterministic grid for the map.
   - One region per seed, left to right; titles shared by two
     seeds sit in a crossover region between them.
   - In each region, titles on a reading path run down the first
     column in reading order; other titles branch off to the right
     next to the title they link to.
   - Path lines join card centres and bend around any card in the
     way (e.g. a skipped title), as bypass() does in the reference.
   ============================================================ */

export const CARD_W = 184;
export const CARD_H = 72;
const COL_W = CARD_W + 136;
const ROW_H = CARD_H + 80;
const PAD = 40;
const LABEL_H = 32;
const GROUP_GAP = 56;
const TOP = 96;
const MAX_COLS = 4;

// Reading order across the whole map: follow edges and path order, then year.
function globalOrder(nodes, edges, paths) {
  const ids = nodes.map((n) => n.id);
  const inSet = new Set(ids);
  const preds = new Map(ids.map((id) => [id, new Set()]));
  const link = (a, b) => { if (inSet.has(a) && inSet.has(b) && a !== b) preds.get(b).add(a); };
  for (const e of edges) link(e.source, e.target);
  for (const p of paths) p.nodeIds.forEach((id, i) => { if (i > 0) link(p.nodeIds[i - 1], id); });
  const year = new Map(nodes.map((n, i) => [n.id, (parseInt(n.year, 10) || 9999) * 1000 + i]));
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

// Region keys in left-to-right order: seed 1, crossovers of 1 & 2, seed 2, …
function groupKeyOf(node, seedIndex) {
  const idx = (node.seedIds || []).map((id) => seedIndex.get(id)).filter((i) => i !== undefined).sort((a, b) => a - b);
  if (idx.length <= 1) return `s${idx[0] ?? 0}`;
  return `x${idx[0]}`;
}

function groupRank(key) {
  const i = Number(key.slice(1));
  return key[0] === 's' ? i * 2 : i * 2 + 1;
}

/**
 * nodes: the titles to draw; edges: connectors between them; paths: full
 * path lists (ids may include titles that aren't drawn).
 * Returns { pos: Map(id → {x, y}) top-left of each card, regions, width, height }.
 */
export function computeMetroLayout(nodes, edges, paths, seeds) {
  const seedIndex = new Map((seeds || []).map((s, i) => [s.id, i]));
  const onPath = new Set(paths.flatMap((p) => p.nodeIds));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbours = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    neighbours.get(e.source)?.push(e.target);
    neighbours.get(e.target)?.push(e.source);
  }

  const groups = new Map();
  for (const id of globalOrder(nodes, edges, paths)) {
    const key = groupKeyOf(byId.get(id), seedIndex);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }

  const pos = new Map();
  const regions = [];
  let x0 = PAD;
  let height = 0;

  for (const key of [...groups.keys()].sort((a, b) => groupRank(a) - groupRank(b))) {
    const cell = new Map(); // `${col},${row}` → id
    const at = new Map(); // id → { col, row }
    let mainRow = -1;
    let lastRow = 0;
    for (const id of groups.get(key)) {
      let col;
      let row;
      if (onPath.has(id)) {
        col = 0;
        row = mainRow + 1;
        while (cell.has(`0,${row}`)) row++;
        mainRow = row;
      } else {
        const linked = neighbours.get(id).map((nid) => at.get(nid)).filter(Boolean);
        row = linked.length > 0 ? Math.min(...linked.map((p) => p.row)) : lastRow;
        col = 1;
        while (cell.has(`${col},${row}`)) {
          col++;
          if (col > MAX_COLS - 1) { col = 1; row++; }
        }
      }
      cell.set(`${col},${row}`, id);
      at.set(id, { col, row });
      lastRow = Math.max(lastRow, row);
    }

    // Drop empty columns (e.g. a crossover region with nothing on a path).
    const usedCols = [...new Set([...at.values()].map((p) => p.col))].sort((a, b) => a - b);
    const colX = new Map(usedCols.map((c, i) => [c, i]));
    const cols = usedCols.length;
    const rows = Math.max(...[...at.values()].map((p) => p.row)) + 1;

    const inner = { x: x0 + PAD, y: TOP + PAD + LABEL_H };
    for (const [id, p] of at) {
      pos.set(id, { x: inner.x + colX.get(p.col) * COL_W, y: inner.y + p.row * ROW_H });
    }
    const w = (cols - 1) * COL_W + CARD_W + PAD * 2;
    const h = (rows - 1) * ROW_H + CARD_H + PAD * 2 + LABEL_H;
    const seedIdxs = key[0] === 's' ? [Number(key.slice(1))] : [Number(key.slice(1)), Number(key.slice(1)) + 1];
    regions.push({ key, x: x0, y: TOP, w, h, crossover: key[0] === 'x', seeds: seedIdxs.map((i) => seeds?.[i]).filter(Boolean) });
    x0 += w + GROUP_GAP;
    height = Math.max(height, TOP + h);
  }

  return { pos, regions, width: x0 - GROUP_GAP + PAD, height: height + 160 };
}

export function centre(pos, id) {
  const p = pos.get(id);
  return { x: p.x + CARD_W / 2, y: p.y + CARD_H / 2 };
}

// A connector from one card's edge to another's, with its midpoint for the label.
export function connectorPath(pos, from, to) {
  const a = pos.get(from);
  const b = pos.get(to);
  let s;
  let t;
  if (Math.abs(a.y - b.y) < CARD_H) {
    const right = b.x > a.x;
    s = { x: right ? a.x + CARD_W : a.x, y: a.y + CARD_H / 2 };
    t = { x: right ? b.x - 6 : b.x + CARD_W + 6, y: b.y + CARD_H / 2 };
    const mx = (s.x + t.x) / 2;
    return { d: `M ${s.x} ${s.y} C ${mx} ${s.y}, ${mx} ${t.y}, ${t.x} ${t.y}`, mid: { x: mx, y: (s.y + t.y) / 2 } };
  }
  const down = b.y > a.y;
  s = { x: a.x + CARD_W / 2, y: down ? a.y + CARD_H : a.y };
  t = { x: b.x + CARD_W / 2, y: down ? b.y - 6 : b.y + CARD_H + 6 };
  const my = (s.y + t.y) / 2;
  return { d: `M ${s.x} ${s.y} C ${s.x} ${my}, ${t.x} ${my}, ${t.x} ${t.y}`, mid: { x: (s.x + t.x) / 2, y: my } };
}

// One segment of a path line between two card centres. If another card sits
// in the same column between them, the line bows out to the left around it.
function segment(pos, u, v, cardIds) {
  const a = centre(pos, u);
  const b = centre(pos, v);
  const between = a.x === b.x && cardIds.some((id) => {
    if (id === u || id === v) return false;
    const c = centre(pos, id);
    return c.x === a.x && c.y > Math.min(a.y, b.y) && c.y < Math.max(a.y, b.y);
  });
  if (between) {
    const xo = a.x - CARD_W / 2 - 52;
    const m = (a.y + b.y) / 2;
    const h = Math.abs(m - a.y) * 0.55;
    const dir = b.y > a.y ? 1 : -1;
    return ` C ${a.x} ${a.y + dir * h}, ${xo} ${m - dir * h}, ${xo} ${m} C ${xo} ${m + dir * h}, ${b.x} ${b.y - dir * h}, ${b.x} ${b.y}`;
  }
  if (a.x === b.x || a.y === b.y) return ` L ${b.x} ${b.y}`;
  const my = (a.y + b.y) / 2;
  return ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
}

/**
 * The route of a reading path through its kept titles, starting at its pill.
 * Returns { start, segments: [{ u, v, d }] } where u is null for the lead-in.
 */
export function pathRoute(pos, keptIds, allCardIds, pillIndex = 0) {
  if (keptIds.length === 0) return null;
  const first = pos.get(keptIds[0]);
  const start = { x: first.x + CARD_W / 2 + pillIndex * 96, y: first.y - 48 };
  const firstC = centre(pos, keptIds[0]);
  const segments = [{ u: null, v: keptIds[0], d: `M ${start.x} ${start.y + 28} L ${firstC.x} ${firstC.y}` }];
  for (let i = 0; i + 1 < keptIds.length; i++) {
    const u = keptIds[i];
    const c = centre(pos, u);
    segments.push({ u, v: keptIds[i + 1], d: `M ${c.x} ${c.y}${segment(pos, u, keptIds[i + 1], allCardIds)}` });
  }
  return { start, segments };
}

// The whole route as one path, for the animated trace.
export function joinRoute(route) {
  return route.segments.map((s, i) => (i === 0 ? s.d : s.d.replace(/^M [-0-9.]+ [-0-9.]+/, ''))).join('');
}
