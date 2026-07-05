'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: string_theory
//  +N per FULLY FILLED row and column this treat touches
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['string_theory'] = {
  buildFn(ef, phase) {
    const amt = extractNum(ef);
    return (b, cats, ts, p, cs) => {
      const allTCells = Array.isArray(p[0]) ? p : [p];
      const rows = new Set(allTCells.map(([r]) => r));
      const cols = new Set(allTCells.map(([, c]) => c));
      const rowFull = r => {
        for (let c = 0; c < G.bsc; c++) {
          const cell = b[r][c];
          if (cell.blocked || cell.offShape) continue;
          if (!cell.filled) return false;
        }
        return true;
      };
      const colFull = c => {
        for (let r = 0; r < G.bsr; r++) {
          const cell = b[r][c];
          if (cell.blocked || cell.offShape) continue;
          if (!cell.filled) return false;
        }
        return true;
      };
      let count = 0;
      rows.forEach(r => { if (rowFull(r)) count++; });
      cols.forEach(c => { if (colFull(c)) count++; });
      return { scoreBonus: amt * count };
    };
  },
};
