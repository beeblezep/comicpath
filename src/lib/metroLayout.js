/* ============================================================
   Metro layout — a deterministic grid for the map.
   - One region per seed, left to right; titles shared by two
     seeds sit in a crossover region between them.
   - In each region, the titles on its reading path zigzag down it:
     left to right, then right to left on the next row, so earlier
     titles sit higher. A second path's titles in the same region
     follow on below the first's.
   - Other titles sit in a row just under the title they link to,
     or just over it when they are read before it (e.g. a prequel),
     never where the path turns down to its next row.
   - Path lines join card centres and bend around any card in the
     way (e.g. a skipped title), as bypass() does in the reference.
   ============================================================ */

import { readingOrder } from './model.js';

export const CARD_W = 184;
export const CARD_H = 72;
const COL_W = CARD_W + 136;
const ROW_H = CARD_H + 80;
const PAD = 40;
const LABEL_H = 32;
const GROUP_GAP = 56;
const TOP = 96;
const PATH_COLS = 3;

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
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbours = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    neighbours.get(e.source)?.push(e.target);
    neighbours.get(e.target)?.push(e.source);
  }
  // Titles every edge leads out of: read before all they link to.
  const readFirst = new Set(nodes.map((n) => n.id).filter((id) => neighbours.get(id).length > 0
    && edges.every((e) => e.target !== id)));
  const pathLists = paths.map((p) => p.nodeIds.filter((id) => byId.has(id)));

  const groups = new Map();
  const order = readingOrder(nodes.map((n) => n.id), nodes, edges, pathLists);
  for (const id of order) {
    const key = groupKeyOf(byId.get(id), seedIndex);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }

  const pos = new Map();
  const regions = [];
  let x0 = PAD;
  let height = 0;

  for (const key of [...groups.keys()].sort((a, b) => groupRank(a) - groupRank(b))) {
    const inGroup = new Set(groups.get(key));
    const line = [...new Set(pathLists.flat().filter((id) => inGroup.has(id)))];
    const cols = Math.max(1, Math.min(PATH_COLS, line.length));
    const pathRows = Math.max(1, Math.ceil(line.length / cols));
    // Grid rows: 3r is the row over path row r, 3r + 1 path row r, 3r + 2 the row under it.
    const cell = new Map(); // `${col},${row}` → id
    const at = new Map(); // id → { col, row }
    const place = (id, col, row) => {
      cell.set(`${col},${row}`, id);
      at.set(id, { col, row });
    };
    const turnCol = (r) => (r % 2 === 0 ? cols - 1 : 0); // where path row r turns down
    const blocked = (col, row) => {
      const r = Math.floor(row / 3);
      if (row % 3 === 2) return r + 1 < pathRows && col === turnCol(r);
      return row % 3 === 0 && r > 0 && col === turnCol(r - 1);
    };
    // The free cell in a row nearest a column, away from where the path turns.
    const placeNear = (id, col, row) => {
      for (let d = 0; ; d++) {
        // Of two cells as near, the one inside the path's columns.
        const pair = col - d >= 0 && col - d < cols ? [col - d, col + d] : [col + d, col - d];
        for (const c of d === 0 ? [col] : pair) {
          if (!cell.has(`${c},${row}`) && !blocked(c, row)) { place(id, c, row); return; }
        }
      }
    };
    // Next to the first placed title it links to: beside it if that title is
    // off the path, else in the row under it (or over it, for a lead-in).
    const placeBy = (id, over) => {
      const linked = neighbours.get(id).map((nid) => at.get(nid)).filter(Boolean)
        .sort((a, b) => a.row - b.row || a.col - b.col)[0];
      if (!linked) { placeNear(id, 0, 3 * (pathRows - 1) + 2); return; }
      if (linked.row % 3 !== 1) { placeNear(id, linked.col + (over ? -1 : 1), linked.row); return; }
      placeNear(id, linked.col, linked.row + (over ? -1 : 1));
    };

    line.forEach((id, i) => {
      const r = Math.floor(i / cols);
      place(id, r % 2 === 0 ? i % cols : cols - 1 - (i % cols), 3 * r + 1);
    });

    // A title read before everything it links to (e.g. a prequel) sits over
    // them once the rest are placed.
    const leadsIn = [];
    for (const id of groups.get(key)) {
      if (at.has(id)) continue;
      if (readFirst.has(id) && neighbours.get(id).some((nid) => inGroup.has(nid))) leadsIn.push(id);
      else placeBy(id, false);
    }
    // Latest first, so a chain of these runs leftwards in reading order.
    for (const id of leadsIn.reverse()) placeBy(id, true);

    // Drop empty rows and columns.
    const usedCols = [...new Set([...at.values()].map((p) => p.col))].sort((a, b) => a - b);
    const usedRows = [...new Set([...at.values()].map((p) => p.row))].sort((a, b) => a - b);
    const colX = new Map(usedCols.map((c, i) => [c, i]));
    const rowY = new Map(usedRows.map((r, i) => [r, i]));

    const inner = { x: x0 + PAD, y: TOP + PAD + LABEL_H };
    for (const [id, p] of at) {
      pos.set(id, { x: inner.x + colX.get(p.col) * COL_W, y: inner.y + rowY.get(p.row) * ROW_H });
    }
    const w = (usedCols.length - 1) * COL_W + CARD_W + PAD * 2;
    const h = (usedRows.length - 1) * ROW_H + CARD_H + PAD * 2 + LABEL_H;
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
// between them in the same column, the line bows out to the left around it;
// in the same row, it dips under it.
function segment(pos, u, v, cardIds) {
  const a = centre(pos, u);
  const b = centre(pos, v);
  const inWay = (c) => (a.x === b.x
    ? c.x === a.x && c.y > Math.min(a.y, b.y) && c.y < Math.max(a.y, b.y)
    : a.y === b.y && c.y === a.y && c.x > Math.min(a.x, b.x) && c.x < Math.max(a.x, b.x));
  const between = (a.x === b.x || a.y === b.y) && cardIds.some((id) => id !== u && id !== v && inWay(centre(pos, id)));
  if (between && a.x === b.x) {
    const xo = a.x - CARD_W / 2 - 52;
    const m = (a.y + b.y) / 2;
    const h = Math.abs(m - a.y) * 0.55;
    const dir = b.y > a.y ? 1 : -1;
    return ` C ${a.x} ${a.y + dir * h}, ${xo} ${m - dir * h}, ${xo} ${m} C ${xo} ${m + dir * h}, ${b.x} ${b.y - dir * h}, ${b.x} ${b.y}`;
  }
  if (between) {
    const yo = a.y + CARD_H / 2 + (ROW_H - CARD_H) / 2;
    const m = (a.x + b.x) / 2;
    const w = Math.abs(m - a.x) * 0.55;
    const dir = b.x > a.x ? 1 : -1;
    return ` C ${a.x + dir * w} ${a.y}, ${m - dir * w} ${yo}, ${m} ${yo} C ${m + dir * w} ${yo}, ${b.x - dir * w} ${b.y}, ${b.x} ${b.y}`;
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
