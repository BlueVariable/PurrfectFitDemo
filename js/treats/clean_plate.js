'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: clean_plate
//  +N — requires PURRFECT FIT! (requirement enforced centrally)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['clean_plate'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      return { scoreBonus: amt };
    };
  },
};
