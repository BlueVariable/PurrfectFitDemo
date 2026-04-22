'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: standing_ovation
//  Charges for 3 uses, then duplicates a random treat from inventory
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['standing_ovation'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const plays = (G.treatPlayCounts.standing_ovation || 0) + 1;
      G.treatPlayCounts.standing_ovation = plays;

      if (plays % 3 !== 0) {
        return { type: 'x', charging: `${plays % 3}/3` };
      }

      const pool = G.bpGroups.filter(grp => grp.tdef && grp.tdef.id !== 'standing_ovation');
      if (!pool.length) return { type: 'x', skip: true };

      const target = pool[Math.floor(Math.random() * pool.length)];
      const cloned = Object.assign({}, target.tdef);
      if (!bpAutoPlace(cloned)) return { type: 'x', skip: true };

      return { type: 'x', duplicatedTreat: target.tdef };
    };
  },
};
