'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: nap
//  Multiplies all cats by ×N, only if ≤1 treat on board
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['nap'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Requirement "NO OTHER TREAT" is enforced centrally in doFit() so jumping_ball can disable it
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
