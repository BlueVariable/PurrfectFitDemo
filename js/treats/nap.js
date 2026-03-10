'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: nap
//  Multiplies all cats by ×N, only if ≤1 treat on board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['nap'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ts.length <= 1 ? allMulCS(cats, cs, m) : { gids: [], m: 1 };
  },
};
