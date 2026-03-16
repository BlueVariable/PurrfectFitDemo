'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: window_perch
//  +N to cats with any cell on the board's outer edge
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['window_perch'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const bonusMap = {};
      cats.forEach(grp => {
        const hit = grp.cells.some(([r,c]) => r===0||r===G.bsr-1||c===0||c===G.bsc-1);
        if (hit) bonusMap[grp.gid] = amt;
      });
      return { bonusMap };
    };
  },
};
