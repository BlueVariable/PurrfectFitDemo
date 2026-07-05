'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: cat_pile
//  +N per cat cell in the LARGEST connected CAT PILE
//  (flood-fill across ALL cat cells on the board, 4-adjacency,
//  regardless of which cat group owns each cell)
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['cat_pile'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const seen = Array.from({ length: G.bsr }, () => Array(G.bsc).fill(false));
      let largest = 0;
      for (let r = 0; r < G.bsr; r++) for (let c = 0; c < G.bsc; c++) {
        if (seen[r][c] || !b[r][c].filled || b[r][c].kind !== 'cat') continue;
        let size = 0;
        const stack = [[r, c]];
        seen[r][c] = true;
        while (stack.length) {
          const [cr, cc] = stack.pop();
          size++;
          [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]].forEach(([nr, nc]) => {
            if (nr < 0 || nr >= G.bsr || nc < 0 || nc >= G.bsc || seen[nr][nc]) return;
            if (!b[nr][nc].filled || b[nr][nc].kind !== 'cat') return;
            seen[nr][nc] = true;
            stack.push([nr, nc]);
          });
        }
        if (size > largest) largest = size;
      }
      return { scoreBonus: amt * largest };
    };
  },
};
