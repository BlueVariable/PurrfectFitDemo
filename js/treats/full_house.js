'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: full_house
//  ×N — req: EVERY ROW must contain a CAT (enforced centrally in
//  requirements.js; rows with no playable cells are exempt).
//  The anti-clustering multiplier: pays for spreading cats across
//  every floor of the box instead of piling them into one corner.
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['full_house'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      return { scoreMultiplier: true, m };
    };
  },
};
