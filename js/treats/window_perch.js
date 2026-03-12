'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: window_perch
//  ×N cats with any cell on the board's outer edge
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['window_perch'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const gids = cats
        .filter(grp => grp.cells.some(([r,c]) => r===0||r===G.bsr-1||c===0||c===G.bsc-1))
        .map(grp => grp.gid);
      return { gids, m };
    };
  },
};
