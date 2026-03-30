'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: last_resort
//  ×N ALL cats — requirement: NO DISCARDS REMAINING
//  Requirement enforced centrally in doFit()
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['last_resort'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
