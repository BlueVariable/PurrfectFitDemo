'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: tuna_can
//  ×N all orange cat groups
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['tuna_can'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Multiplies ORANGE cats that fire at/after this treat in scan order.
    return (b, cats) => typeMul(cats, ['orange'], m);
  },
};
