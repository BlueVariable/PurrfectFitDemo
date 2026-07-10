'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: shadow_feast
//  ×N all BLACK cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['shadow_feast'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Multiplies SIAMESE cats that fire at/after this treat in scan order.
    // ('black' kept alongside for the brief published-CSV rename lag.)
    // Place it early (top-left) to catch all of them.
    return (b, cats) => typeMul(cats, ['siamese', 'black'], m);
  },
};
