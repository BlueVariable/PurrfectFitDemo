'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: biscuit
//  +N per FILLED cell on the entire board (any kind, including itself)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['biscuit'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      let filled = 0;
      for (let r = 0; r < G.bsr; r++) {
        for (let c = 0; c < G.bsc; c++) {
          if (b[r][c].filled) filled++;
        }
      }
      return { scoreBonus: filled * amt };
    };
  },
};
