import { forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide } from 'd3-force';

const BASE_RADIUS = 14;
const WEIGHT_SCALE = 5;

export function nodeRadius(weight) {
  return BASE_RADIUS + (weight || 3) * WEIGHT_SCALE;
}

// Each seed gets its own column of the canvas; a title is pulled toward the
// column of its seed, so a crossover settles between the seeds it belongs to.
function seedColumns(seeds, width) {
  const cols = new Map();
  (seeds || []).forEach((s, i) => cols.set(s.id, (width * (i + 0.5)) / seeds.length));
  return cols;
}

function targetX(node, cols, width) {
  const xs = (node.seedIds || []).map((id) => cols.get(id)).filter((x) => x !== undefined);
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : width / 2;
}

export function computeConstellationLayout(nodes, edges, width, height, previousPositions, seeds) {
  if (!nodes || nodes.length === 0) return { positions: new Map(), edgePaths: [] };

  const cols = seedColumns(seeds, width);
  const simNodes = nodes.map((n) => {
    const prev = previousPositions?.get(n.id);
    return {
      id: n.id,
      weight: n.weight || 3,
      isSeed: !!n.isSeed,
      crossover: !n.isSeed && (n.seedIds?.length || 0) > 1,
      tx: targetX(n, cols, width),
      ...(prev ? { x: prev.x, y: prev.y } : {}),
    };
  });

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

  const simLinks = edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
    }));

  // Seed anchors are pinned at the middle of their own column.
  for (const n of simNodes) {
    if (!n.isSeed) continue;
    n.fx = n.tx;
    n.fy = height / 2;
  }

  const sim = forceSimulation(simNodes)
    .force('link', forceLink(simLinks)
      .id((d) => d.id)
      .distance((link) => {
        const sw = link.source.weight || 3;
        const tw = link.target.weight || 3;
        return 200 + (10 - sw - tw) * 18;
      })
      .strength(0.6))
    .force('charge', forceManyBody()
      .strength((d) => -400 - d.weight * 80))
    .force('x', forceX((d) => d.tx).strength((d) => (d.crossover ? 0.35 : 0.12)))
    .force('y', forceY(height / 2).strength(0.05))
    .force('collide', forceCollide()
      .radius((d) => nodeRadius(d.weight) + 90)
      .strength(1))
    .stop();

  sim.tick(300);

  const positions = new Map();
  for (const n of simNodes) {
    const pad = nodeRadius(n.weight) + 4;
    positions.set(n.id, {
      x: Math.max(pad, Math.min(width - pad, n.x)),
      y: Math.max(pad, Math.min(height - pad, n.y)),
    });
  }

  const edgePaths = simLinks.map((link) => {
    const sp = positions.get(typeof link.source === 'object' ? link.source.id : link.source);
    const tp = positions.get(typeof link.target === 'object' ? link.target.id : link.target);
    return {
      x1: sp.x,
      y1: sp.y,
      x2: tp.x,
      y2: tp.y,
      type: link.type,
      sourceId: typeof link.source === 'object' ? link.source.id : link.source,
      targetId: typeof link.target === 'object' ? link.target.id : link.target,
    };
  });

  return { positions, edgePaths };
}
