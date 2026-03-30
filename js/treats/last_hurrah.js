'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: last_hurrah
//  ×2 ALL cats — only on the last hand of the round
//  Requirement "LAST HAND" enforced centrally in doFit()
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['last_hurrah'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
