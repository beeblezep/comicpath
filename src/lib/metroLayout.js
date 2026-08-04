const MAIN_X = 60;
const NODE_SPACING_Y = 120;
const BRANCH_START_X = 240;
const BRANCH_SPACING_X = 140;
const BRANCH_BASE_Y = 40;
const BRANCH_GAP_Y = 44;
const NODE_R = 14;
const BRANCH_R = 10;
const PADDING_TOP = 40;
const PADDING_BOTTOM = 60;
const PADDING_RIGHT = 40;

export function computeLayout(mainLine) {
  const nodes = [];
  const lines = [];
  let maxX = MAIN_X;
  let maxY = PADDING_TOP;

  for (let i = 0; i < mainLine.length; i++) {
    const stop = mainLine[i];
    const y = PADDING_TOP + i * NODE_SPACING_Y;
    if (y > maxY) maxY = y;

    nodes.push({
      id: stop.id,
      x: MAIN_X,
      y,
      r: NODE_R,
      title: stop.title,
      year: stop.year,
      issues: stop.issues,
      why: stop.why,
      tier: stop.tier,
      isMain: true,
    });

    if (i > 0) {
      const prevY = PADDING_TOP + (i - 1) * NODE_SPACING_Y;
      lines.push({ x1: MAIN_X, y1: prevY, x2: MAIN_X, y2: y, isMain: true, dashed: false });
    }

    const branches = stop.branches || [];
    for (let j = 0; j < branches.length; j++) {
      const branch = branches[j];
      if (!Array.isArray(branch)) continue;

      for (let k = 0; k < branch.length; k++) {
        const bn = branch[k];
        const bx = BRANCH_START_X + k * BRANCH_SPACING_X;
        const by = y + BRANCH_BASE_Y + j * BRANCH_GAP_Y;

        nodes.push({
          id: bn.id,
          x: bx,
          y: by,
          r: BRANCH_R,
          title: bn.title,
          year: bn.year,
          issues: bn.issues,
          why: bn.why,
          tier: bn.tier,
          isMain: false,
        });

        if (k === 0) {
          lines.push({ x1: MAIN_X, y1: y, x2: bx, y2: by, isMain: false, dashed: true });
        } else {
          const prevBx = BRANCH_START_X + (k - 1) * BRANCH_SPACING_X;
          lines.push({ x1: prevBx, y1: by, x2: bx, y2: by, isMain: false, dashed: true });
        }

        if (bx > maxX) maxX = bx;
        if (by > maxY) maxY = by;
      }
    }
  }

  return {
    nodes,
    lines,
    width: maxX + PADDING_RIGHT + 140,
    height: maxY + PADDING_BOTTOM,
  };
}
