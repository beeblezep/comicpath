import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

const clamp = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * Pinch-to-zoom for a scrolling canvas. Trackpad pinches arrive as wheel
 * events with ctrlKey set (Chrome, Firefox, Edge) or as gesture events
 * (Safari); either way the point under the cursor stays put.
 */
export function useCanvasZoom(scrollRef) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const anchor = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    function zoomTo(next, clientX, clientY) {
      const prev = zoomRef.current;
      const z = clamp(next);
      if (z === prev) return;
      const rect = el.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      anchor.current = { mx, my, cx: (el.scrollLeft + mx) / prev, cy: (el.scrollTop + my) / prev };
      zoomRef.current = z;
      setZoom(z);
    }

    function onWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    }

    let gestureStart = 1;
    function onGestureStart(e) {
      e.preventDefault();
      gestureStart = zoomRef.current;
    }
    function onGestureChange(e) {
      e.preventDefault();
      zoomTo(gestureStart * e.scale, e.clientX, e.clientY);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [scrollRef]);

  // Scroll so the canvas point that was under the cursor is under it again.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = anchor.current;
    if (!el || !a) return;
    anchor.current = null;
    el.scrollLeft = a.cx * zoom - a.mx;
    el.scrollTop = a.cy * zoom - a.my;
  }, [zoom, scrollRef]);

  return zoom;
}
