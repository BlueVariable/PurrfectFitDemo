'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: rainbow_row
//  +N per ROW that contains K+ distinct CAT TYPES
//  (K parsed from the effect text, e.g. "2+ CAT TYPES")
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['rainbow_row'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    const tm = ef.match(/(\d+)\+/);
    const threshold = tm ? parseInt(tm[1]) : 3;
    return (b, cats, ts, p, cs) => {
      let rows = 0;
      for (let r = 0; r < G.bsr; r++) {
        const types = new Set();
        for (let c = 0; c < G.bsc; c++) {
          if (b[r][c].kind === 'cat' && b[r][c].type) types.add(b[r][c].type);
        }
        if (types.size >= threshold) rows++;
      }
      return { scoreBonus: rows * amt };
    };
  },
};
