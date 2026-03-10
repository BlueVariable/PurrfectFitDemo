'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: frenzy
//  Multiplies surrounding cats by ×N only if all cats
//  on the board are the same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['frenzy'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      if ([...new Set(cats.map(c => c.type))].length > 1) return { gids: [], m: 1 };
      return surrMulCS(b, cats, p, m, cs);
    };
  },
};
