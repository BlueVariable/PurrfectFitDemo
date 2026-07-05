'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: toy_mouse
//  +N per cat SCORED AFTER this treat in scan order
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['toy_mouse'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => ({ scoreBonus: amt * cats.length });
  },
};
