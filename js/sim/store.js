'use strict';
// ══════════════════════════════════════════════════════
//  SIM: results persistence — File System Access API + IndexedDB
//
//  Auto-saves each completed batch's results JSON into a user-chosen
//  folder. Chrome-only by design (showDirectoryPicker / createWritable are
//  File System Access API); every path degrades to the classic blob
//  download when the API, the stored permission, or the write itself is
//  unavailable — the picker path is the enhancement, the download path is
//  the guarantee.
//
//  The chosen DirectoryHandle is persisted in IndexedDB (FileSystemHandle
//  is structured-cloneable in Chrome), so it survives page reloads.
//  Permission is NOT re-requested at load: requestPermission() requires a
//  user gesture, so at write time we only queryPermission() — if it says
//  'prompt', that batch falls back to a download and the folder button UI
//  is flagged so the user can re-grant with a click (a real gesture).
// ══════════════════════════════════════════════════════

const SIM_STORE_DB_NAME = 'pf-sim-store';
const SIM_STORE_KV = 'kv';
const SIM_STORE_RUNS = 'runs';
const SIM_STORE_DIR_KEY = 'resultsDir';
const SIM_STORE_DB_VERSION = 2;

function simStoreSupported(){
  return typeof window.showDirectoryPicker === 'function';
}

// ── tiny promise-wrapped IndexedDB store ──
// v1: only the `kv` store (results-folder handle).
// v2: adds the `runs` store — the in-app history of completed/imported batches
//     (keyPath 'id', autoIncrement; index on 'savedAt' for newest-first lists).
// The upgrade handler is version-agnostic (creates whatever is missing) so it
// migrates a v1 DB in place without dropping the stored folder handle.
function simIdbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SIM_STORE_DB_NAME, SIM_STORE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SIM_STORE_KV)) db.createObjectStore(SIM_STORE_KV);
      if (!db.objectStoreNames.contains(SIM_STORE_RUNS)){
        const runs = db.createObjectStore(SIM_STORE_RUNS, { keyPath: 'id', autoIncrement: true });
        runs.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function simIdbGet(key){
  return simIdbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SIM_STORE_KV, 'readonly');
    const req = tx.objectStore(SIM_STORE_KV).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}
function simIdbSet(key, val){
  return simIdbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SIM_STORE_KV, 'readwrite');
    const req = tx.objectStore(SIM_STORE_KV).put(val, key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

// ── DirectoryHandle persistence ──
function simStoreGetDirHandle(){
  return simIdbGet(SIM_STORE_DIR_KEY).then(h => h || null).catch(() => null);
}
function simStoreSetDirHandle(handle){
  return simIdbSet(SIM_STORE_DIR_KEY, handle);
}

// ── permission helpers ──
// Older Chrome exposes handles without query/requestPermission; treat that
// as 'granted' and let the actual write attempt decide (it's wrapped in a
// try/catch with a download fallback anyway).
async function simQueryDirPermission(handle){
  if (!handle) return 'denied';
  if (typeof handle.queryPermission !== 'function') return 'granted';
  try{ return await handle.queryPermission({ mode: 'readwrite' }); }
  catch(e){ return 'denied'; }
}
// Only call from a user-gesture handler (button click) — Chrome rejects
// permission requests outside gestures.
async function simRequestDirPermission(handle){
  if (!handle) return 'denied';
  if (typeof handle.requestPermission !== 'function') return 'granted';
  try{ return await handle.requestPermission({ mode: 'readwrite' }); }
  catch(e){ return 'denied'; }
}

// ── writing ──
async function simWriteFileToDir(dirHandle, filename, text){
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

// Classic blob download — the universal fallback (lands in the browser's
// Downloads directory). Also used by the manual Export button.
function simDownloadTextAsFile(filename, text){
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── filename builder ──
// sim_<branch>_<profileInitials>_<games>x_seed<baseSeed>_<hash8>_<YYYYMMDD-HHMMSS>[_partial].json
function simBuildResultFilename(meta){
  const p2 = n => String(n).padStart(2, '0');
  const d = meta.date || new Date();
  const stampStr = '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) +
    '-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
  const branch = String(meta.branchId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  const initials = (meta.profiles || []).map(p => String(p).charAt(0)).join('') || 'x';
  const hash8 = String(meta.configHash || 'nohash').slice(0, 8);
  return 'sim_' + branch + '_' + initials + '_' + meta.gamesPerProfile + 'x_seed' + meta.baseSeed +
    '_' + hash8 + '_' + stampStr + (meta.partial ? '_partial' : '') + '.json';
}

// ── one-call auto-save ──
// Tries the persisted folder first; on ANY problem (no folder, permission
// not currently granted, write failure) falls back to a download of the
// same file. Returns { ok, method:'folder'|'download', filename, note,
// needsRegrant } — the caller surfaces `note` in the status line and flags
// the folder button when `needsRegrant` is true.
async function simAutoSaveResults(json, meta){
  const filename = simBuildResultFilename(meta);
  const handle = await simStoreGetDirHandle();
  if (handle){
    const perm = await simQueryDirPermission(handle);
    if (perm === 'granted'){
      try{
        await simWriteFileToDir(handle, filename, json);
        return { ok: true, method: 'folder', filename, needsRegrant: false,
          note: 'Auto-saved ' + filename + ' to "' + handle.name + '".' };
      }catch(err){
        simDownloadTextAsFile(filename, json);
        return { ok: false, method: 'download', filename, needsRegrant: false,
          note: 'WARNING: writing to "' + handle.name + '" failed (' + ((err && err.message) || err) + ') — downloaded ' + filename + ' instead.' };
      }
    }
    // 'prompt' (or 'denied'): cannot requestPermission here — batch
    // completion is not a user gesture. Download this one and ask the user
    // to click the folder button to re-grant.
    simDownloadTextAsFile(filename, json);
    return { ok: false, method: 'download', filename, needsRegrant: true,
      note: 'WARNING: folder permission must be re-granted (click "Choose results folder") — downloaded ' + filename + ' instead.' };
  }
  simDownloadTextAsFile(filename, json);
  return { ok: true, method: 'download', filename, needsRegrant: false,
    note: 'Auto-saved ' + filename + ' (no folder chosen — downloaded).' };
}

// ══════════════════════════════════════════════════════
//  In-app run history (IndexedDB `runs` store)
//
//  Every completed batch — and every imported file — is recorded here so the
//  simulator can list past runs and re-render any of them without re-running.
//  A record is { id, savedAt, summary, payload }:
//    payload = the full { stamp, results } object the dashboard renders from.
//    summary = a small precomputed blob for the list view, so listing never
//              has to load or re-aggregate the (potentially large) results.
//  All helpers fail soft: if IndexedDB is unavailable or a transaction errors,
//  they reject, and callers treat history as best-effort (import + live runs
//  keep working; only persistence is lost).
// ══════════════════════════════════════════════════════

// Add one record. `savedAt` is stamped by the caller (browser Date is fine).
// Returns the new autoincrement id.
function simHistoryAdd(record){
  return simIdbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SIM_STORE_RUNS, 'readwrite');
    const req = tx.objectStore(SIM_STORE_RUNS).add(record);
    req.onsuccess = () => { const id = req.result; db.close(); resolve(id); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

// List metadata only (id, savedAt, summary) — never the full results — newest
// first. Keeps the history panel cheap even with big batches stored.
function simHistoryList(){
  return simIdbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SIM_STORE_RUNS, 'readonly');
    const req = tx.objectStore(SIM_STORE_RUNS).getAll();
    req.onsuccess = () => {
      db.close();
      const rows = (req.result || []).map(r => ({ id: r.id, savedAt: r.savedAt, summary: r.summary }));
      rows.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
      resolve(rows);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  })).catch(() => []);
}

// Full record (with payload) for one id, or null if missing.
function simHistoryGet(id){
  return simIdbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SIM_STORE_RUNS, 'readonly');
    const req = tx.objectStore(SIM_STORE_RUNS).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

function simHistoryDelete(id){
  return simIdbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SIM_STORE_RUNS, 'readwrite');
    const req = tx.objectStore(SIM_STORE_RUNS).delete(id);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

function simHistoryClear(){
  return simIdbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SIM_STORE_RUNS, 'readwrite');
    const req = tx.objectStore(SIM_STORE_RUNS).clear();
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

// ── payload validation / normalization (for imported files) ──
// A per-game result must at least carry a `profile` and a `rounds` array — the
// two fields every dashboard aggregation reaches for. Accepts either the
// wrapped { results:[...] } shape or a bare [...] array; returns a normalized
// { stamp, results } payload, or null if it does not look like sim results.
function simValidatePayload(obj){
  let results = null;
  if (Array.isArray(obj)) results = obj;
  else if (obj && Array.isArray(obj.results)) results = obj.results;
  if (!results || !results.length) return null;
  const looksLikeGame = g => g && typeof g === 'object' &&
    typeof g.profile === 'string' && Array.isArray(g.rounds);
  if (!results.every(looksLikeGame)) return null;
  const stamp = (obj && obj.stamp && typeof obj.stamp === 'object') ? obj.stamp : {};
  return { stamp, results };
}

// Resolve the round count a payload's dashboard should span:
//   1) an explicit maxRound (stored in the summary going forward),
//   2) else the largest round number present in the data,
//   3) else 0 (empty → dashboard renders its "no games" state).
function simResolveMaxRound(payload, explicitMaxRound){
  if (explicitMaxRound && explicitMaxRound > 0) return explicitMaxRound;
  let max = 0;
  const results = (payload && payload.results) || [];
  results.forEach(g => (g.rounds || []).forEach(r => {
    if (r && typeof r.round === 'number' && r.round > max) max = r.round;
  }));
  return max;
}

// Build the compact list-view summary for a history record.
function simBuildRunSummary(meta, results){
  const profiles = meta.profiles || [];
  const winRateByProfile = {};
  profiles.forEach(p => {
    const games = results.filter(r => r.profile === p);
    winRateByProfile[p] = games.length
      ? (games.filter(g => g.result === 'won').length / games.length) * 100
      : null;
  });
  return {
    branchId: meta.branchId || null,
    profiles,
    profileInitials: profiles.map(p => String(p).charAt(0)).join('') || '—',
    gamesPerProfile: meta.gamesPerProfile != null ? meta.gamesPerProfile : null,
    baseSeed: meta.baseSeed != null ? meta.baseSeed : null,
    configHash: meta.configHash || null,
    maxRound: meta.maxRound || 0,
    partial: !!meta.partial,
    totalGames: results.length,
    winRateByProfile,
    source: meta.source || 'batch'
  };
}
