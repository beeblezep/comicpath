import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import '../../styles/map.css';
import { EDGE_LABELS, seedNodeIds, slugify } from '../../lib/model';
import { CARD_H, computeMetroLayout, connectorPath, joinRoute, pathRoute } from '../../lib/metroLayout';
import {
  hiddenIds, isIn, keptCards, pathCards, pathChanged, readingRows, relations, summaryText, toggleKind,
} from '../../lib/readingPaths';
import { useMapState } from '../../hooks/useMapState';
import { useCanvasZoom } from '../../hooks/useCanvasZoom';
import { ChatDrawer } from '../ChatDrawer';
import { TitleCard } from './TitleCard';
import { SeedRegion } from './SeedRegion';
import { Connector, ConnectorLabel, ConnectorMarkers } from './Connector';
import { PathBand, PathTrace } from './PathLine';
import { PathContinue, PathPill } from './PathPill';
import { Legend } from './Legend';
import { TitleDetails } from './TitleDetails';
import { ReadingView } from './ReadingView';

const MARKER_ID = 'metro-arrow';

// Connector labels are centred pills; two closer than this would overlap.
const LABEL_W = 120;
const LABEL_H = 28;

// Labels for the selected title's connectors, told from its side: a title
// read before it leads up to it, one read after directly follows it. Labels
// are kept clear of each other: one that would sit on a label saying the same
// thing is dropped, any other is nudged down until it is clear.
function placeLabels(edges, pos, sel) {
  const placed = [];
  const hits = (x, y) => placed.find((p) => Math.abs(p.x - x) < LABEL_W && Math.abs(p.y - y) < LABEL_H);
  for (const e of edges) {
    if (e.source !== sel && e.target !== sel) continue;
    const text = e.target === sel ? EDGE_LABELS.before : EDGE_LABELS.after;
    const { mid } = connectorPath(pos, e.source, e.target);
    let y = mid.y;
    let hit = hits(mid.x, y);
    if (hit?.text === text) continue;
    while (hit) {
      y = hit.y + LABEL_H;
      hit = hits(mid.x, y);
    }
    placed.push({ e, text, x: mid.x, y });
  }
  return placed;
}

function toggleLabel(node, kind, inPath, pathName) {
  const t = node.title;
  if (kind === 'adds') return inPath ? `Take ${t} off ${pathName}` : `Add ${t} to ${pathName}`;
  if (kind === 'skip') return inPath ? `Skip ${t} in your reading path` : `Put ${t} back in your reading path`;
  return inPath ? `Remove ${t} from the map` : `Put ${t} back on the map`;
}

function actionLabel(kind, isInPath, pathName) {
  if (kind === 'adds') return isInPath ? `Remove from ${pathName}` : `Add to ${pathName}`;
  if (kind === 'skip') return isInPath ? 'Skip in reading path' : 'Put back in reading path';
  return isInPath ? 'Remove from the map' : 'Put back on the map';
}

/**
 * The reading-path map: titles grouped by seed, connectors for reading order,
 * metro lines for the suggested reading paths, plus the legend, the details
 * drawer, the reading view and the chat drawer for expanding.
 */
export function MetroMap({
  graph, readingList, alreadyRead, onClose, onExpand, onExpandMany, expandedIds, expandingIds,
  history, format, onSetFormat, formatQuestion, onAnswerFormat, onCancelFormat, onNewPath,
  title, intro, placeholder, search,
}) {
  const map = useMapState(graph);
  const [chatOpen, setChatOpen] = useState(true);
  const scrollRef = useRef(null);
  const zoom = useCanvasZoom(scrollRef);
  const paths = useMemo(() => graph.paths || [], [graph.paths]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const { collapsed, removed, showSkipped } = map;
  const hidden = useMemo(
    () => hiddenIds(graph, { collapsed, removed, showSkipped }),
    [graph, collapsed, removed, showSkipped],
  );
  const visibleNodes = useMemo(() => graph.nodes.filter((n) => !hidden.has(n.id)), [graph.nodes, hidden]);
  const visibleEdges = useMemo(
    () => graph.edges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target)),
    [graph.edges, hidden],
  );
  const cardIds = useMemo(() => visibleNodes.map((n) => n.id), [visibleNodes]);

  // The layout only depends on what is drawn, so skipping or adding a title
  // never moves anything; essential titles on a path form each main line.
  const layout = useMemo(() => {
    const mainLines = paths.map((p) => ({
      ...p,
      nodeIds: p.nodeIds.filter((id) => !hidden.has(id) && byId.get(id)?.category === 'essential'),
    }));
    return computeMetroLayout(visibleNodes, visibleEdges, mainLines, graph.seeds);
  }, [visibleNodes, visibleEdges, paths, hidden, byId, graph.seeds]);

  const state = { skip: map.skip, adds: map.adds, removed: map.removed, pins: map.pins };
  const cardsByPath = Object.fromEntries(paths.map((p) => [p.id, pathCards(p, byId, map, hidden)]));
  const keptByPath = Object.fromEntries(paths.map((p) => [p.id, keptCards(cardsByPath[p.id], map)]));
  const active = paths.map((p) => p.id).filter((k) => map.pins[k] || map.hover === k);
  const sel = map.sel && !hidden.has(map.sel) ? map.sel : null;
  const infoNode = map.info && !hidden.has(map.info) ? byId.get(map.info) : null;
  const anyPinned = paths.some((p) => map.pins[p.id]);

  // What is lit: the active paths' titles, or the selection and its neighbours.
  const inActive = new Set(active.flatMap((k) => cardsByPath[k]));
  const linked = new Set(sel ? [sel] : []);
  if (sel) for (const e of visibleEdges) {
    if (e.source === sel) linked.add(e.target);
    if (e.target === sel) linked.add(e.source);
  }
  const steps = new Map();
  if (active.length > 0) {
    const seq = [];
    for (const k of active) for (const id of cardsByPath[k]) if (!seq.includes(id)) seq.push(id);
    seq.filter((id) => !map.skip[id]).forEach((id, i) => steps.set(id, i + 1));
  }

  const edgeOpacity = (a, b) => {
    if (active.length > 0) return inActive.has(a) && inActive.has(b) ? (map.skip[a] || map.skip[b] ? 0.45 : 1) : 0.12;
    if (sel) return a === sel || b === sel ? 1 : 0.12;
    return 1;
  };

  // Routes, pills and the Continue hand-off for each path.
  const firstCounts = new Map();
  const routes = paths.map((p) => {
    const kept = keptByPath[p.id];
    if (kept.length === 0) return { path: p, route: null };
    const i = firstCounts.get(kept[0]) || 0;
    firstCounts.set(kept[0], i + 1);
    return { path: p, route: pathRoute(layout.pos, kept, cardIds, i) };
  });
  const bandOpacity = (key) => (seg) => {
    if (active.length > 0) {
      const inU = seg.u === null ? active.includes(key) : inActive.has(seg.u);
      return inU && inActive.has(seg.v) ? 1 : 0.12;
    }
    if (sel) return seg.u === sel || seg.v === sel ? 1 : 0.12;
    return 1;
  };
  const lastActive = active.length > 0 ? paths.findIndex((p) => p.id === active[active.length - 1]) : -1;
  const nextPath = lastActive >= 0 ? paths[lastActive + 1] : null;
  const continueAt = nextPath && !active.includes(nextPath.id) && keptByPath[paths[lastActive].id].length > 0
    ? layout.pos.get(keptByPath[paths[lastActive].id].at(-1))
    : null;

  const summary = summaryText({ active, paths, cardsByPath, byId, state, sel, edges: visibleEdges });
  const labels = sel ? placeLabels(visibleEdges, layout.pos, sel) : [];
  const skippedCount = graph.nodes.filter((n) => !n.anchor && (n.category === 'skip' || map.removed[n.id])).length;

  const handleSelect = useCallback((id, e) => {
    if (e?.shiftKey || e?.metaKey) map.toggleChat(id);
    else map.select(id);
  }, [map]);

  const handleExpandSeed = useCallback((seed) => {
    const anchor = graph.nodes.find((n) => n.isSeed && n.seedIds[0] === seed.id);
    if (anchor) onExpand(anchor.id);
  }, [graph.nodes, onExpand]);

  // The format question is answered in the chat, so it has to be in view.
  useEffect(() => {
    if (formatQuestion) setChatOpen(true);
  }, [formatQuestion]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      const tag = e.target?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') { e.target.blur(); return; }
      if (map.rv) map.setRv(false);
      else if (map.info) map.setInfo(null);
      else if (map.sel || Object.values(map.pins).some(Boolean)) map.clearAll();
      else onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, onClose]);

  // Details drawer content.
  let details = null;
  if (infoNode) {
    const id = infoNode.id;
    const chips = paths.filter((p) => cardsByPath[p.id].includes(id)).map((p) => (map.skip[id]
      ? { text: `Skipped in ${p.name}` }
      : { text: `${p.name} · step ${keptByPath[p.id].indexOf(id) + 1}`, path: true }));
    for (const e of graph.edges) {
      if (e.type === 'prequel' && e.source === id) chips.push({ text: `Prequel to ${byId.get(e.target)?.title}` });
    }
    const kind = toggleKind(infoNode, paths);
    const pathName = paths.find((p) => p.nodeIds.includes(id))?.name;
    const { before, after } = relations(id, visibleEdges);
    details = {
      chips, before, after,
      action: { label: actionLabel(kind, isIn(infoNode, paths, map), pathName), go: () => map.toggleIn(infoNode) },
    };
  }

  const rvKeys = anyPinned ? paths.filter((p) => map.pins[p.id]).map((p) => p.id) : paths.map((p) => p.id);
  const rvTotal = rvKeys.reduce((sum, k) => sum + keptByPath[k].length, 0);

  return (
    <div className={`metro${chatOpen && onExpandMany ? ' chat-open' : ''}`}>
      <header className="metro-header">
        <div className="metro-heading">
          <h1 className="metro-title">{title || 'Reading path'}</h1>
          <div className="metro-summary">{graph.nodes.length > 0 ? summary : placeholder}</div>
        </div>
        <div className="metro-actions">
          {paths.length > 0 && (
            <button type="button" className="metro-btn is-primary" onClick={() => { map.setRv(true); map.setHover(null); }}>
              Reading view
            </button>
          )}
          {(sel || anyPinned) && (
            <button type="button" className="metro-btn is-quiet" onClick={map.clearAll}>Show all connections</button>
          )}
          {onNewPath && <button type="button" className="metro-btn" onClick={onNewPath}>New path</button>}
          <button type="button" className="metro-btn" onClick={onClose}>← Back</button>
        </div>
      </header>

      <div className="metro-body">
        <div className="metro-scroll" ref={scrollRef} onClick={map.clearAll}>
          <div style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div className="metro-canvas" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            {graph.nodes.length === 0 && placeholder && <div className="metro-placeholder">{placeholder}</div>}

            {layout.regions.map((r) => (
              <SeedRegion key={r.key} region={r} dim={!!sel || active.length > 0} onExpandSeed={onExpand ? handleExpandSeed : null} />
            ))}

            <svg className="metro-layer" width={layout.width} height={layout.height}>
              {routes.map(({ path, route }) => route && (
                <PathBand
                  key={path.id}
                  segments={route.segments}
                  opacityOf={bandOpacity(path.id)}
                  onEnter={() => map.hoverPath(path.id)}
                  onLeave={map.leavePath}
                  onClick={() => map.togglePin(path.id)}
                />
              ))}
              {routes.map(({ path, route }) => route && active.includes(path.id) && (
                <PathTrace key={`${path.id}-${active.join('')}`} d={joinRoute(route)} delay={`${active.indexOf(path.id) * 900}ms`} />
              ))}
            </svg>

            <svg className="metro-layer" width={layout.width} height={layout.height}>
              <ConnectorMarkers id={MARKER_ID} />
              {visibleEdges.map((e, i) => (
                <Connector key={i} d={connectorPath(layout.pos, e.source, e.target).d} kind={e.kind} opacity={edgeOpacity(e.source, e.target)} markerId={MARKER_ID} />
              ))}
            </svg>

            {labels.map(({ e, text, x, y }) => (
              <ConnectorLabel key={`${e.source}->${e.target}`} x={x} y={y} text={text} opacity={edgeOpacity(e.source, e.target)} />
            ))}

            {visibleNodes.map((node) => {
              const p = layout.pos.get(node.id);
              const onPath = paths.some((path) => cardsByPath[path.id].includes(node.id));
              const skipped = !!map.skip[node.id] && onPath;
              const set = node.category === 'skip' || !!map.removed[node.id];
              const kind = toggleKind(node, paths);
              const inPath = isIn(node, paths, map);
              const pathName = paths.find((path) => path.nodeIds.includes(node.id))?.name;
              const hasChildren = graph.nodes.some((n) => n.fromIds?.includes(node.id));
              const expand = expandingIds?.has(node.id) ? 'expanding'
                : expandedIds?.has(node.id) ? (hasChildren ? (map.collapsed[node.id] ? 'collapsed' : 'shown') : null)
                : 'expand';
              const dim = active.length > 0 ? !inActive.has(node.id) : sel ? !linked.has(node.id) : false;
              return (
                <TitleCard
                  key={node.id}
                  node={node}
                  x={p.x}
                  y={p.y}
                  onPath={onPath}
                  skipped={skipped || set}
                  dim={dim}
                  faded={!dim && (skipped || set)}
                  selected={node.id === sel || node.id === infoNode?.id}
                  inChat={map.chatIds.has(node.id)}
                  isRead={alreadyRead.isRead(slugify(node.title))}
                  inPath={inPath}
                  toggleLabel={toggleLabel(node, kind, inPath, pathName)}
                  expand={onExpand ? expand : null}
                  onSelect={handleSelect}
                  onToggle={map.toggleIn}
                  onInfo={(id) => map.setInfo(map.info === id ? null : id)}
                  onExpand={(id) => onExpand(id)}
                  onToggleCollapsed={map.toggleCollapsed}
                />
              );
            })}

            {[...steps].map(([id, n]) => {
              const p = layout.pos.get(id);
              return <div key={id} className="step-badge" style={{ left: p.x, top: p.y }}>{n}</div>;
            })}

            {routes.map(({ path, route }) => route && (
              <PathPill
                key={path.id}
                path={path}
                x={route.start.x}
                y={route.start.y}
                pinned={!!map.pins[path.id]}
                onEnter={() => map.hoverPath(path.id)}
                onLeave={map.leavePath}
                onClick={() => map.togglePin(path.id)}
                onReset={pathChanged(path, byId, map) ? map.resetPath : null}
              />
            ))}
            {continueAt && (
              <PathContinue
                next={nextPath}
                x={continueAt.x}
                y={continueAt.y + CARD_H + 10}
                onEnter={() => { if (!map.pins[paths[lastActive].id]) map.hoverPath(paths[lastActive].id); }}
                onLeave={map.leavePath}
                onClick={() => map.pinOnly([...active, nextPath.id])}
              />
            )}
          </div>
          </div>
        </div>

        <Legend showSkipped={map.showSkipped} onToggleSkipped={() => map.setShowSkipped((v) => !v)} skippedCount={skippedCount} />
      </div>

      {infoNode && (
        <TitleDetails
          node={infoNode}
          seeds={graph.seeds}
          byId={byId}
          {...details}
          readingList={readingList}
          alreadyRead={alreadyRead}
          subject={title}
          expandable={!expandedIds?.has(infoNode.id)}
          expanding={!!expandingIds?.has(infoNode.id)}
          onOpen={map.setInfo}
          onClose={() => map.setInfo(null)}
          onExpand={onExpand}
        />
      )}

      {map.rv && (
        <ReadingView
          heading={rvKeys.map((k) => paths.find((p) => p.id === k)?.name).filter(Boolean).join(' + ') || 'Reading path'}
          total={rvTotal}
          rows={readingRows({ keys: rvKeys, paths, cardsByPath, byId, state, edges: visibleEdges, seeds: graph.seeds })}
          paths={paths}
          shown={anyPinned ? rvKeys : []}
          onTogglePath={map.togglePin}
          onInfo={(id) => { map.setRv(false); map.setInfo(id); }}
          onRemove={(id) => map.toggleIn(byId.get(id))}
          onClose={() => map.setRv(false)}
        />
      )}

      {onExpandMany && (
        <ChatDrawer
          open={chatOpen}
          onToggle={() => setChatOpen((p) => !p)}
          nodes={graph.nodes}
          selectedIds={map.chatIds}
          onToggleSelect={map.toggleChat}
          onSetSelection={(ids) => map.setChatIds(new Set(ids))}
          onClearSelection={() => map.setChatIds(new Set())}
          seedNodeIds={seedNodeIds(graph)}
          focusedNode={infoNode}
          history={history || []}
          intro={intro}
          search={search}
          format={format}
          onSetFormat={onSetFormat}
          formatQuestion={formatQuestion}
          onAnswerFormat={onAnswerFormat}
          onCancelFormat={onCancelFormat}
          busy={!!expandingIds && expandingIds.size > 0}
          onSend={(ids, prompt) => onExpandMany(ids, prompt, 'chat')}
        />
      )}
    </div>
  );
}
