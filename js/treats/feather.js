'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: feather
//  +N to cats in same column as treat
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['feather'] = {
  buildFn(ef, phase) {
    return (b, c, ts, p) => colAdd(b, p, extractNum(ef));
  },
};
