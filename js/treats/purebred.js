'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purebred
//  ×2 ALL cats — req: all cats are the same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purebred'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
