'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cat_phone
//  Copies the mul treat that would give the most extra score
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cat_phone'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const mulTreats = ts.filter(t => t.tdef.id !== 'cat_phone' && t.tdef.phase === 'mul');
      if (!mulTreats.length) return { type: 'x', skip: true };
      let best = null, bestScore = 0;
      mulTreats.forEach(mt => {
        const res = mt.tdef.fn(b, cats, ts, mt.cells, cs);
        if (!res || !res.gids || !res.gids.length || res.m <= 1) return;
        const extra = res.gids.reduce((sum, gid) => sum + (cs[gid] || 0) * (res.m - 1), 0);
        if (extra > bestScore) { bestScore = extra; best = { mt, res }; }
      });
      if (!best) return { type: 'x', skip: true };
      return { type: 'x', subPhase: 'mul', result: best.res, copiedFrom: best.mt.tdef };
    };
  },
};
