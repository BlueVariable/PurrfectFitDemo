'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: yarn
//  ×N L-shaped cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['yarn'] = {
  buildFn(ef, phase) {
    return (b, cats) => shapeMul(cats, ['L'], extractMul(ef));
  },
};
