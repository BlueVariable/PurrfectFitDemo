'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: high_rise
//  +N per ROW containing at least one cat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['high_rise'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      let rows = 0;
      for (let r = 0; r < G.bsr; r++) {
        let hasCat = false;
        for (let c = 0; c < G.bsc; c++) if (b[r][c].kind === 'cat' && b[r][c].filled) { hasCat = true; break; }
        if (hasCat) rows++;
      }
      return { scoreBonus: amt * rows };
    };
  },
};
