const TIER_COLORS = {
  essential: 'var(--color-tier-essential)',
  recommended: 'var(--color-tier-recommended)',
  optional: 'var(--color-tier-optional)',
};

export function MetroMapNode({ node, selected, onClick }) {
  const color = TIER_COLORS[node.tier] || TIER_COLORS.recommended;

  return (
    <g
      onClick={() => onClick(node)}
      style={{ cursor: 'pointer' }}
    >
      {selected && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.r + 6}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.35}
        />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={node.r}
        fill={node.isMain ? color : 'var(--color-surface)'}
        stroke={color}
        strokeWidth={node.isMain ? 0 : 2}
      />
      <text
        x={node.isMain ? node.x + node.r + 10 : node.x + node.r + 8}
        y={node.y - 6}
        fill="var(--color-text)"
        fontSize={node.isMain ? 13 : 11}
        fontWeight={node.isMain ? 600 : 400}
      >
        {node.title}
      </text>
      {node.year && (
        <text
          x={node.isMain ? node.x + node.r + 10 : node.x + node.r + 8}
          y={node.y + 12}
          fill="var(--color-muted)"
          fontSize={10}
        >
          {node.year}{node.issues ? ` · ${node.issues}` : ''}
        </text>
      )}
    </g>
  );
}
