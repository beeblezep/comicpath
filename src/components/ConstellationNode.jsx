import { nodeRadius } from '../lib/constellationLayout';

const TIER_COLORS = {
  essential: '#7c5cfc',
  recommended: '#e8a33d',
  optional: '#7c7c8a',
};

export function ConstellationNode({ node, x, y, focused, dimmed, alreadyRead, hidden, onClick }) {
  if (hidden) return null;

  const r = nodeRadius(node.weight);
  const color = TIER_COLORS[node.tier] || TIER_COLORS.recommended;
  const opacity = dimmed ? 0.15 : alreadyRead ? 0.5 : 1;

  return (
    <g
      data-node={node.id}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      style={{ cursor: 'pointer', transition: 'opacity .25s ease' }}
      opacity={opacity}
    >
      <circle
        cx={x} cy={y} r={r}
        fill="#1b1c26"
        stroke={color}
        strokeWidth={focused ? 3 : 2}
      />
      {alreadyRead && (
        <text
          x={x} y={y + 1}
          textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize={r * 0.8} fontWeight={700}
        >
          ✓
        </text>
      )}
      <text
        x={x + r + 12} y={y - 2}
        fill="#eae7de"
        stroke="#08080d" strokeWidth={4} paintOrder="stroke"
        fontFamily="'SF Mono', Menlo, Consolas, monospace"
        fontSize={14}
        style={{ pointerEvents: 'none', letterSpacing: '0.01em' }}
      >
        {node.title.length > 28 ? node.title.slice(0, 26) + '…' : node.title}
      </text>
      <text
        x={x + r + 12} y={y + 16}
        fill="#7c7c8a"
        stroke="#08080d" strokeWidth={4} paintOrder="stroke"
        fontFamily="'SF Mono', Menlo, Consolas, monospace"
        fontSize={11}
        style={{ pointerEvents: 'none', letterSpacing: '0.04em' }}
      >
        {node.tier} · {node.year || ''}
      </text>
    </g>
  );
}
