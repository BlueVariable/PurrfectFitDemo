'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: potluck
//  +N per DISTINCT cat TYPE SURROUNDING this treat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['potluck'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const allTCells = Array.isArray(p[0]) ? p : [p];
      const types = new Set();
      allTCells.forEach(([tr, tc]) => {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = tr + dr, cc = tc + dc;
          if (rr >= 0 && rr < G.bsr && cc >= 0 && cc < G.bsc && b[rr][cc].kind === 'cat' && b[rr][cc].filled)
            types.add(b[rr][cc].type);
        }
      });
      return { scoreBonus: amt * types.size };
    };
  },
};
