'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: personal_space
//  +N per EMPTY cell on the entire board, to ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['personal_space'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      let emptyCells = 0;
      for (let r = 0; r < G.bsr; r++) {
        for (let c = 0; c < G.bsc; c++) {
          if (!b[r][c].filled) emptyCells++;
        }
      }
      if (!emptyCells) return { bonusMap: {} };
      const totalBonus = emptyCells * amt;
      const bonusMap = {};
      cats.forEach(grp => { bonusMap[grp.gid] = totalBonus; });
      return { bonusMap };
    };
  },
};
