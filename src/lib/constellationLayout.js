import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

const BASE_RADIUS = 14;
const WEIGHT_SCALE = 5;

export function nodeRadius(weight) {
  return BASE_RADIUS + (weight || 3) * WEIGHT_SCALE;
}

export function computeConstellationLayout(nodes, edges, width, height, targetTitle) {
  if (!nodes || nodes.length === 0) return { positions: new Map(), edgePaths: [] };

  const simNodes = nodes.map((n) => ({
    id: n.id,
    weight: n.weight || 3,
    isTarget: targetTitle && n.title === targetTitle,
  }));

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

  const simLinks = edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
    }));

  const targetNode = simNodes.find((n) => n.isTarget);
  if (targetNode) {
    targetNode.fx = width / 2;
    targetNode.fy = height / 2;
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
    .force('center', forceCenter(width / 2, height / 2))
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
