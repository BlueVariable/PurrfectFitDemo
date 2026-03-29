'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: chonk_champ
//  ×3 CHONK shaped cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['chonk_champ'] = {
  buildFn(ef, phase) {
    return (b, cats) => shapeMul(cats, ['chonk'], extractMul(ef));
  },
};
