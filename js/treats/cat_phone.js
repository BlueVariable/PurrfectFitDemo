'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cat_phone
//  Permanently overwrite self with a random backpack treat's ability
//  (persists within a game run, resets on new game)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cat_phone'] = {
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const bpTreats = G.bpGroups.filter(g => g.tdef && g.tdef.id !== 'cat_phone');
      if (!bpTreats.length) return { type: 'x', skip: true };
      const chosen = bpTreats[Math.floor(Math.random() * bpTreats.length)].tdef;
      const self = TDEFS.find(td => td.id === 'cat_phone');
      if (!self) return { type: 'x', skip: true };
      // Save originals for restoration on new game
      if (!self._origCatPhone) {
        self._origCatPhone = { phase: self.phase, ef: self.ef, fn: self.fn, req: self.req, addEf: self.addEf };
      }
      self.phase = chosen.phase;
      self.ef = chosen.ef;
      self.fn = chosen.fn;
      self.req = chosen.req;
      self.addEf = chosen.addEf;
      return { type: 'x', transformedInto: chosen };
    };
  },
};
