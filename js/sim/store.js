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
const SIM_STORE_DIR_KEY = 'resultsDir';

function simStoreSupported(){
  return typeof window.showDirectoryPicker === 'function';
}

// ── tiny promise-wrapped IndexedDB key/value store ──
function simIdbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SIM_STORE_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(SIM_STORE_KV); };
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
