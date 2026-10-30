import { EDGE_TYPES, edgeKind, demotePrequels, linkSeeds, normalizeCategory, normalizeTitle, orientEdges, placePrequels, resolveSeedIds } from './model.js';

function nextId(existingNodes) {
  let max = 0;
  for (const n of existingNodes) {
    const num = Number(/^n(\d+)$/.exec(n.id)?.[1]);
    if (num > max) max = num;
  }
  return max + 1;
}

// A new essential or optional title joins the reading path of a title it is
// linked to — its own seed's path if it can: after that title if it follows
// on, before it if it leads up to it. Titles linked to nothing on a path stay
// off the paths.
function placeOnPaths(paths, newNodes, edges) {
  const next = paths.map((p) => ({ ...p, nodeIds: [...p.nodeIds] }));
  for (const node of newNodes) {
    if (node.category === 'skip') continue;
    const own = (p) => (node.seedIds || []).includes(p.seedId);
    const ordered = [...next.filter(own), ...next.filter((p) => !own(p))];
    const links = edges.filter((e) => e.source === node.id || e.target === node.id);
    for (const path of ordered) {
      const e = links.find((l) => path.nodeIds.includes(l.source === node.id ? l.target : l.source));
      if (!e) continue;
      const after = e.target === node.id ? e.source : null;
      const before = e.source === node.id ? e.target : null;
      const at = path.nodeIds.indexOf(after || before);
      path.nodeIds.splice(after ? at + 1 : at, 0, node.id);
      break;
    }
  }
  return next;
}

export function mergeExpansion(existingGraph, sourceNodeIds, relatedNodes, relatedEdges) {
  const seeds = existingGraph.seeds || [];
  const titleToId = new Map();
  for (const n of existingGraph.nodes) {
    titleToId.set(normalizeTitle(n.title), n.id);
  }

  const sourceNodes = sourceNodeIds
    .map((id) => existingGraph.nodes.find((n) => n.id === id))
    .filter(Boolean);
  // Without seed names from the model, new nodes belong to the seeds of what was expanded.
  const sourceSeedIds = [...new Set(sourceNodes.flatMap((n) => n.seedIds || []))];

  let counter = nextId(existingGraph.nodes);
  const newNodes = [];
  const newNodeIds = [];

  for (const rn of relatedNodes) {
    const key = normalizeTitle(rn.title);
    if (titleToId.has(key)) continue;

    const id = `n${counter++}`;
    titleToId.set(key, id);
    const named = rn.seeds?.length ? resolveSeedIds(rn.seeds, seeds) : [];
    newNodes.push({
      id,
      title: rn.title || 'Untitled',
      year: rn.year || '',
      issues: rn.issues || '',
      why: rn.why || '',
      category: normalizeCategory(rn.category),
      seedIds: named.length > 0 ? named : sourceSeedIds,
      weight: Math.min(5, Math.max(1, Number(rn.weight) || 3)),
      tags: Array.isArray(rn.tags) ? rn.tags : [],
      // What was expanded to find this title, so the map can hide it again.
      fromIds: sourceNodes.map((s) => s.id),
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
    const type = EDGE_TYPES.includes(re.type) ? re.type : 'leads-to';
    newEdges.push({
      source: srcId,
      target: tgtId,
      type,
      kind: edgeKind(type),
      label: re.label || '',
    });
  }

  // New nodes the model left unattached to the existing graph (directly or via
  // other new nodes) would float free, so anchor each such group to the
  // expanded node that shares its seed (or the first one).
  if (sourceNodes.length > 0) {
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
    for (const node of newNodes) {
      if (attached.has(node.id)) continue;
      const anchor = sourceNodes.find((s) => s.seedIds?.some((sid) => node.seedIds.includes(sid))) || sourceNodes[0];
      newEdges.push({ source: anchor.id, target: node.id, type: 'branches-from', kind: 'enh', label: '' });
      attached.add(node.id);
      spread();
    }
  }

  const edges = linkSeeds([...existingGraph.nodes, ...newNodes], [...existingGraph.edges, ...newEdges]);
  const nodes = demotePrequels([...existingGraph.nodes, ...newNodes], edges);
  const paths = placePrequels(placeOnPaths(existingGraph.paths || [], newNodes, edges), edges);
  return {
    graph: {
      ...existingGraph,
      nodes,
      edges: orientEdges(edges, paths),
      paths,
    },
    newNodeIds,
  };
}
