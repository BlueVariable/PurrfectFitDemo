'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: box
//  +N to surrounding cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['box'] = {
  buildFn(ef, phase) {
    return (b, c, ts, p) => surrAdd(b, p, extractNum(ef));
  },
};
