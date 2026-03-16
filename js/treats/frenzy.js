'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: frenzy
//  Multiplies surrounding cats by ×N only if all cats
//  on the board are the same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['frenzy'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Requirement "ALL SAME TYPE" is enforced centrally in doFit() so jumping_ball can disable it
    return (b, cats, ts, p, cs) => surrMulCS(b, cats, p, m, cs);
  },
};
