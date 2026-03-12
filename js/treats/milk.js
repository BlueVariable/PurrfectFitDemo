'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: milk
//  +N to all cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['milk'] = {
  buildFn(ef, phase) {
    return (b, cats) => allAdd(cats, extractNum(ef));
  },
};
