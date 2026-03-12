'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lucky_paw
//  ×4 one random cat, ×½ all others
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lucky_paw'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      if (!cats.length) return { type: 'x', skip: true };
      const luckyIdx = Math.floor(Math.random() * cats.length);
      const luckyGid = cats[luckyIdx].gid;
      const halvedGids = cats.filter(c => c.gid !== luckyGid).map(c => c.gid);
      if (cs[luckyGid] !== undefined) cs[luckyGid] = Math.round(cs[luckyGid] * 4);
      halvedGids.forEach(gid => { if (cs[gid] !== undefined) cs[gid] = Math.round(cs[gid] * 0.5); });
      return { type: 'x', luckyGid, halvedGids };
    };
  },
};
