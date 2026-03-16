'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: all_or_nothing
//  ×5 ALL cats — only if the board is completely filled
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['all_or_nothing'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Requirement "BOARD FULL" is enforced centrally in doFit() so jumping_ball can disable it
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
