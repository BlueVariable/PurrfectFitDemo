'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cat_phone
//  Permanently overwrite self with a random backpack treat's ability
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cat_phone'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const bpTreats = G.bpGroups.filter(g => g.tdef && g.tdef.id !== 'cat_phone');
      if (!bpTreats.length) return { type: 'x', skip: true };
      const chosen = bpTreats[Math.floor(Math.random() * bpTreats.length)].tdef;
      const self = TDEFS.find(td => td.id === 'cat_phone');
      if (!self) return { type: 'x', skip: true };
      self.phase = chosen.phase;
      self.ef = chosen.ef;
      self.fn = chosen.fn;
      self.req = chosen.req;
      self.addEf = chosen.addEf;
      return { type: 'x', transformedInto: chosen };
    };
  },
};
