'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: catnip
//  +N to cats in same row as treat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['catnip'] = {
  buildFn(ef, phase) {
    return (b, c, ts, p) => rowAdd(b, p, extractNum(ef));
  },
};
