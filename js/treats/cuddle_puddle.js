'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cuddle_puddle
//  ×N — requires ALL cells surrounding this treat to be filled.
//  Inline requirement check (mirrors wild_dice's miss precedent):
//  always fires, pays m=1 when the condition isn't met.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cuddle_puddle'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const allTCells = Array.isArray(p[0]) ? p : [p];
      const inP = new Set(allTCells.map(([r, c]) => `${r},${c}`));
      let sawNeighbour = false;
      let allFilled = true;
      allTCells.forEach(([tr, tc]) => {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = tr + dr, cc = tc + dc;
          if (rr < 0 || rr >= G.bsr || cc < 0 || cc >= G.bsc) continue;
          if (inP.has(`${rr},${cc}`)) continue;
          const cell = b[rr][cc];
          if (cell.blocked || cell.offShape) continue;
          sawNeighbour = true;
          if (!cell.filled) allFilled = false;
        }
      });
      if (sawNeighbour && allFilled) return { scoreMultiplier: true, m };
      return { scoreMultiplier: true, m: 1 };
    };
  },
};
