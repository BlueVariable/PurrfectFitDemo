'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purebred
//  ×2 score multiplier — req: all cats same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purebred'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ({ scoreMultiplier: true, m });
  },
};
