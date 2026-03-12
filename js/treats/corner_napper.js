'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: corner_napper
//  +N to cats touching a corner cell of the board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['corner_napper'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const corners = [[0,0],[0,G.bsc-1],[G.bsr-1,0],[G.bsr-1,G.bsc-1]];
      const bonusMap = {};
      cats.forEach(grp => {
        const hit = grp.cells.some(([r,c]) => corners.some(([cr,cc]) => r===cr&&c===cc));
        if (hit) bonusMap[grp.gid] = amt;
      });
      return { bonusMap };
    };
  },
};
