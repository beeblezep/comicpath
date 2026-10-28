// The "Path A" pill at the start of a path, its Reset (once changed), and the
// "Continue with Path B" hand-off under the last title of an active path.
export function PathPill({ path, x, y, pinned, onEnter, onLeave, onClick }) {
  return (
    <button
      type="button"
      className={`path-pill${pinned ? ' is-pinned' : ''}`}
      style={{ left: x, top: y }}
      aria-pressed={pinned}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      Path {path.id}
    </button>
  );
}

export function PathReset({ path, x, y, onReset }) {
  return (
    <button
      type="button"
      className="path-reset"
      style={{ left: x, top: y }}
      aria-label={`Reset Path ${path.id} to the suggested route`}
      onClick={(e) => { e.stopPropagation(); onReset(path); }}
    >
      ↺ Reset
    </button>
  );
}

export function PathContinue({ nextId, x, y, onEnter, onLeave, onClick }) {
  return (
    <button
      type="button"
      className="path-continue"
      style={{ left: x, top: y }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      Continue with Path {nextId} ↓
    </button>
  );
}
