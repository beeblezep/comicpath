const VALID_TIERS = new Set(['essential', 'recommended', 'optional']);
const VALID_EDGE_TYPES = new Set(['leads-to', 'prerequisite', 'branches-from', 'crossover']);

function nextId(existingNodes) {
  let max = 0;
  for (const n of existingNodes) {
    const num = parseInt(n.id.replace('n', ''), 10);
    if (num > max) max = num;
  }
  return max + 1;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mergeExpansion(existingGraph, sourceNodeId, relatedNodes, relatedEdges) {
  const titleToId = new Map();
  for (const n of existingGraph.nodes) {
    titleToId.set(normalizeTitle(n.title), n.id);
  }

  const sourceNode = existingGraph.nodes.find((n) => n.id === sourceNodeId);
  if (sourceNode) {
    titleToId.set(normalizeTitle(sourceNode.title), sourceNode.id);
  }

  let counter = nextId(existingGraph.nodes);
  const newNodes = [];
  const newNodeIds = [];

  for (const rn of relatedNodes) {
    const key = normalizeTitle(rn.title);
    if (titleToId.has(key)) continue;

    const id = `n${counter++}`;
    titleToId.set(key, id);
    newNodes.push({
      id,
      title: rn.title || 'Untitled',
      year: rn.year || '',
      issues: rn.issues || '',
      why: rn.why || '',
      tier: VALID_TIERS.has(rn.tier) ? rn.tier : 'recommended',
      weight: Math.min(5, Math.max(1, Number(rn.weight) || 3)),
      tags: Array.isArray(rn.tags) ? rn.tags : [],
      ...(rn.edition ? { edition: rn.edition, collects: rn.collects || [] } : {}),
    });
    newNodeIds.push(id);
  }

  const existingEdgeKeys = new Set(
    existingGraph.edges.map((e) => `${e.source}->${e.target}`),
  );

  const newEdges = [];
  for (const re of relatedEdges) {
    const srcId = titleToId.get(normalizeTitle(re.sourceTitle));
    const tgtId = titleToId.get(normalizeTitle(re.targetTitle));
    if (!srcId || !tgtId) continue;

    const key = `${srcId}->${tgtId}`;
    const reverseKey = `${tgtId}->${srcId}`;
    if (existingEdgeKeys.has(key) || existingEdgeKeys.has(reverseKey)) continue;

    existingEdgeKeys.add(key);
    newEdges.push({
      source: srcId,
      target: tgtId,
      type: VALID_EDGE_TYPES.has(re.type) ? re.type : 'leads-to',
      label: re.label || '',
    });
  }

  // New nodes the model left unattached to the existing graph (directly or via
  // other new nodes) would float free, so anchor each such group to the source.
  if (sourceNode) {
    const attached = new Set(existingGraph.nodes.map((n) => n.id));
    const spread = () => {
      let grew = true;
      while (grew) {
        grew = false;
        for (const e of newEdges) {
          if (attached.has(e.source) !== attached.has(e.target)) {
            attached.add(e.source);
            attached.add(e.target);
            grew = true;
          }
        }
      }
    };
    spread();
    for (const id of newNodeIds) {
      if (attached.has(id)) continue;
      newEdges.push({ source: sourceNode.id, target: id, type: 'branches-from', label: '' });
      attached.add(id);
      spread();
    }
  }

  return {
    graph: {
      targetTitle: existingGraph.targetTitle,
      nodes: [...existingGraph.nodes, ...newNodes],
      edges: [...existingGraph.edges, ...newEdges],
      pathNote: existingGraph.pathNote,
    },
    newNodeIds,
  };
}
