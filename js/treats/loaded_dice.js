'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: loaded_dice
//  Trigger Wild Dice again (second independent roll)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['loaded_dice'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const wildDice = ts.find(t => t.tdef.id === 'wild_dice');
      if (!wildDice) return { type: 'x', skip: true };
      const result = wildDice.tdef.fn(b, cats, ts, p, cs);
      return { type: 'x', subPhase: 'mul', result, copiedFrom: wildDice.tdef, laserCells: p };
    };
  },
};
