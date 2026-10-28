// A tinted area grouping the titles of one seed (or the crossovers between two).
export function SeedRegion({ region, dim, onExpandSeed }) {
  const type = region.crossover ? 'crossover' : region.seeds[0]?.type || 'character';
  const label = region.crossover
    ? `${region.seeds.map((s) => s.name).join(' + ')} crossovers`
    : region.seeds[0]?.name || 'Titles';
  return (
    <div
      className={`seed-region type-${type}${dim ? ' is-dim' : ''}`}
      style={{ left: region.x, top: region.y, width: region.w, height: region.h }}
    >
      <div className="seed-region-label">
        {label}
        <span className="seed-region-type">{region.crossover ? 'crossover' : type}</span>
        {!region.crossover && onExpandSeed && (
          <button type="button" className="seed-region-expand" onClick={(e) => { e.stopPropagation(); onExpandSeed(region.seeds[0]); }}>
            Expand
          </button>
        )}
      </div>
    </div>
  );
}
