'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: matching_set
//  ×1.5 score multiplier — req: 3+ cats share a shape
//  Requirement enforced centrally via requirementFails()
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['matching_set'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      return { scoreMultiplier: true, m };
    };
  },
};
