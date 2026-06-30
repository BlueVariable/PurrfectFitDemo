'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cotton_cloud
//  ×N all WHITE cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cotton_cloud'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Multiplies WHITE cats that fire at/after this treat in scan order.
    return (b, cats) => typeMul(cats, ['white'], m);
  },
};
