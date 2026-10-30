// The "Start here" pill over a path's first title, its Reset (once changed),
// and the hand-off to the next path under the last title of an active path.
export function PathPill({ path, x, y, pinned, onEnter, onLeave, onClick, onReset }) {
  return (
    <div className="path-start" style={{ left: x, top: y }}>
      <button
        type="button"
        className={`path-pill${pinned ? ' is-pinned' : ''}`}
        aria-pressed={pinned}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        Start here · {path.name}
      </button>
      {onReset && (
        <button
          type="button"
          className="path-reset"
          aria-label={`Reset ${path.name} to the suggested route`}
          onClick={(e) => { e.stopPropagation(); onReset(path); }}
        >
          ↺ Reset
        </button>
      )}
    </div>
  );
}

export function PathContinue({ next, x, y, onEnter, onLeave, onClick }) {
  return (
    <button
      type="button"
      className="path-continue"
      style={{ left: x, top: y }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      Next: {next.name} →
    </button>
  );
}
