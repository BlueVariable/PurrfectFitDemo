'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: jumping_ball
//  Disables one random treat's requirement for the current hand
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['jumping_ball'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const pool = ts.filter(t => t.tdef.id !== 'jumping_ball' && t.tdef.req);
      if (!pool.length) return { type: 'x', skip: true };
      const target = pool[Math.floor(Math.random() * pool.length)];
      target.tdef._origReq = target.tdef.req;
      target.tdef.req = '';
      return { type: 'x', disabledTreat: target.tdef };
    };
  },
};
