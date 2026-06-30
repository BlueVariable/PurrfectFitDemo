'use strict';
TREAT_REGISTRY['silver_lining'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    // Multiplies GREY cats that fire at/after this treat in scan order.
    return (b, cats) => typeMul(cats, ['grey'], m);
  },
};
