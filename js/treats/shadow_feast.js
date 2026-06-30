'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: shadow_feast
//  ×N all BLACK cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['shadow_feast'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Multiplies BLACK cats that fire at/after this treat in scan order.
    // Place it early (top-left) to catch all of them.
    return (b, cats) => typeMul(cats, ['black'], m);
  },
};
