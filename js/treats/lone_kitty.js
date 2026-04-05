'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lone_kitty
//  ×2 score multiplier — req: no same-type cats adjacent
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lone_kitty'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ({ scoreMultiplier: true, m });
  },
};
