import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { computeConstellationLayout } from '../lib/constellationLayout';
import { ConstellationEdge } from './ConstellationEdge';
import { ConstellationNode } from './ConstellationNode';
import { ConstellationDetail } from './ConstellationDetail';
import { ConstellationToolbar } from './ConstellationToolbar';
import { ConstellationChat, CHAT_WIDTH } from './ConstellationChat';

const CANVAS_W = 1600;
const CANVAS_H = 1000;
const LERP = 0.12;
const MIN_VB_W = 400;
const MAX_VB_W = 2400;
const MONO = "'SF Mono', Menlo, Consolas, monospace";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function ConstellationMap({ graph, readingList, alreadyRead, character, onClose, onExpand, onExpandMany, expandedIds, expandingIds, history, format, onSetFormat, formatQuestion, onAnswerFormat, onCancelFormat, seedNodeId, onNewPath, title }) {
  const [focusedId, setFocusedId] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [tierFilter, setTierFilter] = useState(new Set(['essential', 'recommended', 'optional']));
  const [showHidden, setShowHidden] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [chatOpen, setChatOpen] = useState(true);

  const hasChat = !!onExpandMany;
  const leftOffset = hasChat && chatOpen ? CHAT_WIDTH + 34 : 34;

  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const dragging = useRef(null);

  const vbTarget = useRef({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });
  const vbCurrent = useRef({ x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });

  const prevPositions = useRef(null);

  const { positions, edgePaths } = useMemo(() => {
    const result = computeConstellationLayout(graph.nodes, graph.edges, CANVAS_W, CANVAS_H, graph.targetTitle, prevPositions.current);
    prevPositions.current = result.positions;
    return result;
  }, [graph]);

  const fullBounds = useMemo(() => {
    if (!containerRef.current) return { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
    const el = containerRef.current;
    const aspect = el.clientWidth / el.clientHeight;
    let w = CANVAS_W;
    let h = w / aspect;
    if (h < CANVAS_H) {
      h = CANVAS_H;
      w = h * aspect;
    }
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2;
    return { x, y, w, h };
  }, [positions]);

  useEffect(() => {
    const fb = fullBounds;
    vbTarget.current = { ...fb };
    vbCurrent.current = { ...fb };
    if (svgRef.current) {
      svgRef.current.setAttribute('viewBox', `${fb.x} ${fb.y} ${fb.w} ${fb.h}`);
    }
  }, [fullBounds]);

  useEffect(() => {
    function tick() {
      const c = vbCurrent.current;
      const t = vbTarget.current;
      c.x = lerp(c.x, t.x, LERP);
      c.y = lerp(c.y, t.y, LERP);
      c.w = lerp(c.w, t.w, LERP);
      c.h = lerp(c.h, t.h, LERP);
      if (svgRef.current) {
        svgRef.current.setAttribute('viewBox', `${c.x} ${c.y} ${c.w} ${c.h}`);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // The format question is answered in the chat, so an expand from the detail
  // panel has to bring the chat into view.
  useEffect(() => {
    if (formatQuestion) setChatOpen(true);
  }, [formatQuestion]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        const tag = e.target?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') {
          e.target.blur();
          return;
        }
        if (focusedId) setFocusedId(null);
        else if (onClose) onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedId, onClose]);

  const zoomToNode = useCallback((nodeId) => {
    const pos = positions.get(nodeId);
    if (!pos || !containerRef.current) return;
    const el = containerRef.current;
    const aspect = el.clientWidth / el.clientHeight;
    const w = 700;
    const h = w / aspect;
    const cx = pos.x - w * 0.36;
    const cy = pos.y - h * 0.5;
    vbTarget.current = { x: cx, y: cy, w, h };
  }, [positions]);

  const zoomToFull = useCallback(() => {
    vbTarget.current = { ...fullBounds };
  }, [fullBounds]);

  const connectedToFocused = useMemo(() => {
    if (!focusedId) return null;
    const set = new Set([focusedId]);
    for (const e of graph.edges) {
      if (e.source === focusedId) set.add(e.target);
      if (e.target === focusedId) set.add(e.source);
    }
    return set;
  }, [focusedId, graph.edges]);

  const visibleNodes = useMemo(() => {
    return graph.nodes.filter((n) => {
      if (!tierFilter.has(n.tier)) return false;
      if (hiddenIds.has(n.id) && !showHidden) return false;
      return true;
    });
  }, [graph.nodes, tierFilter, hiddenIds, showHidden]);

  const visibleEdges = useMemo(() => {
    const visibleSet = new Set(visibleNodes.map((n) => n.id));
    return edgePaths.filter((e) => visibleSet.has(e.sourceId) && visibleSet.has(e.targetId));
  }, [edgePaths, visibleNodes]);

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((id, e) => {
    if (dragging.current?.didDrag) return;
    if (hasChat && (e?.shiftKey || e?.metaKey)) {
      toggleSelected(id);
      return;
    }
    setFocusedId((prev) => {
      if (prev === id) {
        zoomToFull();
        return null;
      }
      zoomToNode(id);
      return id;
    });
  }, [zoomToNode, zoomToFull, hasChat, toggleSelected]);

  const handleBackgroundClick = useCallback(() => {
    if (dragging.current?.didDrag) return;
    if (focusedId) {
      setFocusedId(null);
      zoomToFull();
    }
  }, [focusedId, zoomToFull]);

  const handleToggleTier = useCallback((tier) => {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        if (next.size > 1) next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }, []);

  const handleHide = useCallback((id) => {
    setHiddenIds((prev) => new Set(prev).add(id));
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFocusedId(null);
    zoomToFull();
  }, [zoomToFull]);

  const handleToggleRead = useCallback((slug) => {
    alreadyRead.toggleRead(slug);
  }, [alreadyRead]);

  function handleWheel(e) {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const c = vbTarget.current;
    const factor = e.deltaY > 0 ? 1.08 : 0.93;
    let newW = c.w * factor;
    newW = Math.max(MIN_VB_W, Math.min(MAX_VB_W, newW));
    const el = containerRef.current;
    const aspect = el ? el.clientWidth / el.clientHeight : 16 / 9;
    const newH = newW / aspect;
    const newX = c.x + (c.w - newW) * mx;
    const newY = c.y + (c.h - newH) * my;
    vbTarget.current = { x: newX, y: newY, w: newW, h: newH };
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return;
    let el = e.target;
    while (el && el !== e.currentTarget) {
      if (el.dataset && el.dataset.node) return;
      el = el.parentElement;
    }
    const c = vbCurrent.current;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scale = c.w / rect.width;
    dragging.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startVbX: c.x,
      startVbY: c.y,
      scale,
      didDrag: false,
    };
    svg.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.startClientX;
    const dy = e.clientY - dragging.current.startClientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragging.current.didDrag = true;
    const s = dragging.current.scale;
    vbTarget.current.x = dragging.current.startVbX - dx * s;
    vbTarget.current.y = dragging.current.startVbY - dy * s;
  }

  function handlePointerUp() {
    if (dragging.current) {
      setTimeout(() => { dragging.current = null; }, 0);
    }
  }

  const focusedNode = focusedId ? graph.nodes.find((n) => n.id === focusedId) : null;
  const focusedIndex = focusedId ? graph.nodes.findIndex((n) => n.id === focusedId) : -1;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#08080d',
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ display: 'block', cursor: 'grab' }}
        onClick={handleBackgroundClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <rect width={CANVAS_W * 3} height={CANVAS_H * 3} x={-CANVAS_W} y={-CANVAS_H} fill="#08080d" />

        {visibleEdges.map((edge, i) => {
          const lit = connectedToFocused
            ? connectedToFocused.has(edge.sourceId) && connectedToFocused.has(edge.targetId)
            : false;
          const dimmed = connectedToFocused
            ? !lit
            : false;
          return <ConstellationEdge key={i} edge={edge} lit={lit} dimmed={dimmed} />;
        })}

        {visibleNodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const slug = `${character}-${node.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const dimmed = connectedToFocused ? !connectedToFocused.has(node.id) : false;
          return (
            <ConstellationNode
              key={node.id}
              node={node}
              x={pos.x}
              y={pos.y}
              focused={focusedId === node.id}
              dimmed={dimmed}
              alreadyRead={alreadyRead.isRead(slug)}
              hidden={hiddenIds.has(node.id)}
              expandable={expandedIds ? !expandedIds.has(node.id) : false}
              selected={selectedIds.has(node.id)}
              onClick={handleNodeClick}
            />
          );
        })}
      </svg>

      {/* HUD: top-left title */}
      <div style={{
        position: 'fixed', top: 30, left: leftOffset,
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: '#7c7c8a',
        pointerEvents: 'none',
        transition: 'left .35s cubic-bezier(.2,.8,.2,1)',
      }}>
        {title || character || 'Reading Path'}
      </div>

      {/* HUD: top-left new path button */}
      {onNewPath && (
        <button
          onClick={onNewPath}
          style={{
            position: 'fixed', top: 24, left: leftOffset,
            fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '8px 18px', marginTop: 24,
            border: '1px solid #2a2b38',
            background: 'rgba(8,8,13,0.8)',
            color: '#7c7c8a',
            cursor: 'pointer',
            zIndex: 105,
            transition: 'left .35s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          New Path
        </button>
      )}

      {/* HUD: top-right back button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed', top: 24, right: focusedId ? 404 : 30,
          fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '8px 18px',
          border: '1px solid #2a2b38',
          background: 'rgba(8,8,13,0.8)',
          color: '#7c7c8a',
          cursor: 'pointer',
          zIndex: 115,
          transition: 'right .35s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        ← Back
      </button>

      {/* HUD: bottom-left toolbar */}
      <div style={{
        position: 'fixed', bottom: 30, left: leftOffset,
        zIndex: 105,
        transition: 'left .35s cubic-bezier(.2,.8,.2,1)',
      }}>
        <ConstellationToolbar
          tierFilter={tierFilter}
          onToggleTier={handleToggleTier}
          showHidden={showHidden}
          onToggleShowHidden={() => setShowHidden((p) => !p)}
          visibleCount={visibleNodes.length}
          totalCount={graph.nodes.length}
        />
      </div>

      {/* HUD: bottom-right hints */}
      <div style={{
        position: 'fixed', bottom: 30, right: focusedId ? 404 : 30,
        fontFamily: MONO, fontSize: 10, color: '#444',
        textAlign: 'right', lineHeight: 1.8,
        pointerEvents: 'none',
        transition: 'right .35s cubic-bezier(.2,.8,.2,1)',
      }}>
        <div>scroll to zoom</div>
        <div>drag to pan</div>
        <div>esc to close</div>
      </div>

      {/* Side panel */}
      <ConstellationDetail
        node={focusedNode}
        open={!!focusedId}
        readingList={readingList}
        alreadyRead={alreadyRead}
        character={character}
        onToggleRead={handleToggleRead}
        onHide={handleHide}
        onClose={() => { setFocusedId(null); zoomToFull(); }}
        nodeIndex={focusedIndex}
        totalNodes={graph.nodes.length}
        onExpand={onExpand}
        expandable={focusedId && expandedIds ? !expandedIds.has(focusedId) : false}
        expanding={!!focusedId && !!expandingIds?.has(focusedId)}
      />

      {hasChat && (
        <ConstellationChat
          open={chatOpen}
          onToggle={() => setChatOpen((p) => !p)}
          nodes={graph.nodes}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelected}
          onSetSelection={(ids) => setSelectedIds(new Set(ids))}
          onClearSelection={() => setSelectedIds(new Set())}
          seedNodeId={seedNodeId}
          focusedNode={focusedNode}
          history={history || []}
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
