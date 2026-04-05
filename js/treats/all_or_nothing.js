'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: all_or_nothing
//  ×1.5 score multiplier — req: board full
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['all_or_nothing'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ({ scoreMultiplier: true, m });
  },
};
