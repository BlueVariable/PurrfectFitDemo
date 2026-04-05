'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lone_kitty
//  ×2 ALL cats — req: no same-type cats are adjacent
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lone_kitty'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => allMulCS(cats, cs, m);
  },
};
