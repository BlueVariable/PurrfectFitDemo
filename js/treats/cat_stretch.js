'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cat_stretch
//  ×N T-shaped cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cat_stretch'] = {
  buildFn(ef, phase) {
    return (b, cats) => shapeMul(cats, ['T'], extractMul(ef));
  },
};
