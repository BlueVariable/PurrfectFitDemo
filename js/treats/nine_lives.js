'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: nine_lives
//  ×(9 − TREAT COUNT) ALL cats — more powerful with fewer treats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['nine_lives'] = {
  buildFn(ef, phase) {
    return (b, cats, ts) => {
      const m = Math.max(1, 9 - ts.length);
      return { gids: cats.map(c => c.gid), m };
    };
  },
};
