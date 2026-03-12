'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: all_or_nothing
//  ×5 ALL cats — only if the board is completely filled
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['all_or_nothing'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const filled = b.flat().filter(c => c.filled).length;
      if (filled < G.bsr * G.bsc) return { gids: [], m: 1 };
      return allMulCS(cats, cs, m);
    };
  },
};
