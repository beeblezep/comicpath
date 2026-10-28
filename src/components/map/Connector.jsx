import { EDGE_LABELS } from '../../lib/model';

// Solid = read first (rec), dashed = enhances / optional (enh).
export function Connector({ d, kind, opacity, markerId }) {
  return <path className={`connector kind-${kind}`} d={d} style={{ opacity }} markerEnd={`url(#${markerId}-${kind})`} />;
}

export function ConnectorMarkers({ id }) {
  return (
    <defs>
      {['rec', 'enh'].map((kind) => (
        <marker key={kind} id={`${id}-${kind}`} orient="auto" markerWidth="8" markerHeight="8" refX="5" refY="4" overflow="visible">
          <path className={`connector-head kind-${kind}`} d="M0 0 L6 4 L0 8 Z" />
        </marker>
      ))}
    </defs>
  );
}

export function ConnectorLabel({ x, y, kind, opacity }) {
  return <div className="connector-label" style={{ left: x, top: y, opacity }}>{EDGE_LABELS[kind]}</div>;
}
