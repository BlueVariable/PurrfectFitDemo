'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: kitten_toy
//  ×N DUO shaped cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['kitten_toy'] = {
  buildFn(ef, phase) {
    return (b, cats) => shapeMul(cats, ['duo'], extractMul(ef));
  },
};
