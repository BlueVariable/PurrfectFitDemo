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
var PF_MAX_ROWS  = 5000;  // most recent events handed to the dashboard in one read

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

/**
 * GET has two modes:
 *   (no params)  health check — what you see opening the /exec URL in a browser.
 *   ?rows=1      the log itself, for stats.html.
 *
 * The dashboard reads through here rather than through the published CSV
 * because that feed is eventually-consistent: its edge nodes hold different
 * snapshots, so refreshes can serve a stale — sometimes empty — copy for
 * minutes after a write. This reads the live sheet, so what the dashboard shows
 * is what the sheet holds.
 */
function doGet(e) {
  var sh = SpreadsheetApp.openById(PF_SHEET_ID).getSheetByName(PF_TAB);
  if (!sh) return pfOut({ ok: false, error: 'tab "' + PF_TAB + '" not found' });

  var last = sh.getLastRow();
  var total = Math.max(0, last - 1);
  if (!e || !e.parameter || !e.parameter.rows) {
    return pfOut({ ok: true, service: 'purrfect-fit telemetry', rows: total });
  }

  var cols = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, cols).getValues()[0];
  if (!total) return pfOut({ ok: true, total: 0, truncated: false, headers: headers, rows: [] });

  // Newest events matter most, so keep the tail when the log outgrows the cap.
  // Rows go over the wire as bare arrays against one shared header row — the
  // same data as objects-per-row costs several times the bytes.
  var take = Math.min(total, PF_MAX_ROWS);
  var values = sh.getRange(last - take + 1, 1, take, cols).getDisplayValues();
  return pfOut({ ok: true, total: total, truncated: total > take, headers: headers, rows: values });
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
