'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: sunspot
//  ×(unique cat type count) ALL cats
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['sunspot'] = {
  buildFn(ef, phase) {
    return (b, cats) => {
      const uniqueTypes = new Set(cats.map(c => c.type)).size;
      return { gids: cats.map(c => c.gid), m: uniqueTypes };
    };
  },
};
