import { CATEGORIES, CATEGORY_META } from '../../lib/model';
import { CategoryTag } from './CategoryTag';

export function Legend({ showSkipped, onToggleSkipped, skippedCount }) {
  return (
    <aside className="legend" aria-label="Legend" onClick={(e) => e.stopPropagation()}>
      <div className="legend-heading">How to read the lines</div>
      <div className="legend-row">
        <svg className="legend-swatch" height="10" viewBox="0 0 48 10"><path className="path-band" d="M 0 5 L 48 5" /></svg>
        <span>Reading path: hover to trace it; click the line or its label to keep it on. Select several paths to read them in order.</span>
      </div>
      <div className="legend-row">
        <svg className="legend-swatch" height="10" viewBox="0 0 48 10"><path className="connector kind-rec" d="M 0 5 L 48 5" /></svg>
        <span>Solid: read first (highly recommended).</span>
      </div>
      <div className="legend-row">
        <svg className="legend-swatch" height="10" viewBox="0 0 48 10"><path className="connector kind-enh" d="M 0 5 L 48 5" /></svg>
        <span>Dashed: enhances, optional.</span>
      </div>
      <div className="legend-row">
        <span className="legend-swatch region" />
        <span>Tinted area: titles grouped by seed — a character, group or story arc — with crossovers between them.</span>
      </div>
      <div className="legend-row">
        <span className="legend-swatch" />
        <span>No line: a standalone story.</span>
      </div>

      <div className="legend-heading">Title categories</div>
      {CATEGORIES.map((c) => (
        <div key={c} className="legend-row">
          <span className="legend-swatch"><CategoryTag category={c} /></span>
          <span>{CATEGORY_META[c].desc}</span>
        </div>
      ))}

      <div className="legend-heading">Your path</div>
      <span>− skips a title or removes it from the map; + adds an optional title to its path. Shift-click titles to pick them for the chat.</span>
      <button type="button" className="legend-toggle" aria-pressed={showSkipped} onClick={onToggleSkipped}>
        {showSkipped ? 'Hide skipped titles' : `Show skipped titles${skippedCount ? ` (${skippedCount})` : ''}`}
      </button>
    </aside>
  );
}
