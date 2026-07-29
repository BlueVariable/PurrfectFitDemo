/**
 * Purrfect Fit — telemetry collector
 * ══════════════════════════════════════════════════════
 * Receives batched, anonymous play events from js/analytics.js and appends
 * them to the `Telemetry` tab of the config spreadsheet. Deploy this once as
 * a Web app; see docs/analytics.md for the click-by-click.
 *
 * Rows are written in the tab's own header order, looked up per request, so
 * re-ordering or adding a column in the sheet needs no change here — a column
 * the client doesn't send simply stays blank.
 */

var PF_SHEET_ID = '1qEr42p9HsQFPrBip1TqYB2DBehKPgyT_e0CwmNP_Cd4';
var PF_TAB      = 'Telemetry';
var PF_MAX_BATCH = 200;   // per request, so one bad caller can't hog the quota

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Two players finishing a round in the same second would otherwise race for
  // the same append row and one would overwrite the other.
  try { lock.waitLock(25000); } catch (err) { return pfOut({ ok: false, error: 'busy' }); }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var events = (body && body.events) || [];
    if (!events.length) return pfOut({ ok: true, rows: 0 });

    var sh = SpreadsheetApp.openById(PF_SHEET_ID).getSheetByName(PF_TAB);
    if (!sh) return pfOut({ ok: false, error: 'tab "' + PF_TAB + '" not found' });

    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var rows = events.slice(0, PF_MAX_BATCH).map(function (ev) {
      return headers.map(function (h) {
        var v = ev[h];
        if (v === undefined || v === null) return '';
        // Leading apostrophes / equals signs must not become formulas.
        return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;
      });
    });

    var start = sh.getLastRow() + 1;
    pfEnsureRows(sh, start + rows.length);
    sh.getRange(start, 1, rows.length, headers.length).setValues(rows);
    return pfOut({ ok: true, rows: rows.length });
  } catch (err) {
    return pfOut({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (err2) {}
  }
}

/** Health check — opening the /exec URL in a browser should print this. */
function doGet() {
  var sh = SpreadsheetApp.openById(PF_SHEET_ID).getSheetByName(PF_TAB);
  return pfOut({
    ok: true,
    service: 'purrfect-fit telemetry',
    rows: sh ? Math.max(0, sh.getLastRow() - 1) : 0
  });
}

/** Grow the tab before writing past its last row. */
function pfEnsureRows(sh, needed) {
  var have = sh.getMaxRows();
  if (needed > have) sh.insertRowsAfter(have, Math.max(1000, needed - have));
}

function pfOut(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
