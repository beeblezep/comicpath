// A reading path's band (hover to trace, click to pin) and, while the path is
// active, the animated trace drawn over it.
export function PathBand({ segments, opacityOf, onEnter, onLeave, onClick }) {
  return segments.map((s, i) => (
    <g key={i} style={{ opacity: opacityOf(s) }}>
      <path className="path-band" d={s.d} />
      <path
        className="path-hit"
        d={s.d}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      />
    </g>
  ));
}

export function PathTrace({ d, delay }) {
  // pathLength=1 lets the dash animation draw any length of line in the same time.
  return <path className="path-trace" d={d} pathLength="1" style={{ animationDelay: delay }} />;
}
