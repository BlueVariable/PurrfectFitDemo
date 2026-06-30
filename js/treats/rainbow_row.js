'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: rainbow_row
//  +N per ROW that contains 3+ distinct CAT TYPES
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['rainbow_row'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      let rows = 0;
      for (let r = 0; r < G.bsr; r++) {
        const types = new Set();
        for (let c = 0; c < G.bsc; c++) {
          if (b[r][c].kind === 'cat' && b[r][c].type) types.add(b[r][c].type);
        }
        if (types.size >= 3) rows++;
      }
      return { scoreBonus: rows * amt };
    };
  },
};
