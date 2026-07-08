'use strict';
// ══════════════════════════════════════════════════════
//  SIM: UI wiring for sim.html
// ══════════════════════════════════════════════════════
(function(){
  let iframeHandle = null; // { win, bridge } — set up once, reused for every batch
  let running = false;
  let stopRequested = false;
  let allResults = [];
  // What the dashboard currently shows and what Export writes — the live batch,
  // a clicked history record, or an imported file. Kept distinct from
  // allResults so exporting/viewing a loaded run doesn't depend on the last run.
  let displayedPayload = null;
  let activeHistoryId = null; // id of the history row being viewed; null = live batch

  function q(id){ return document.getElementById(id); }

  function setStatus(msg){ q('sim-status').textContent = msg; }
  function setProgress(text){ q('sim-progress').textContent = text; }

  function collectProfiles(){
    return ['solver', 'greedy', 'casual'].filter(p => q('chk-' + p).checked);
  }

  function populateBranchSelect(bridge){
    const sel = q('sel-branch');
    const branches = bridge.getBRANCHES();
    sel.innerHTML = '';
    branches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name + ' (' + b.id + ')';
      sel.appendChild(opt);
    });
    if (branches.some(b => b.id === 'eu_1')) sel.value = 'eu_1';
  }

  async function ensureIframeReady(){
    if (iframeHandle) return iframeHandle;
    setStatus('Loading game iframe + fetching sheet config (this can take a few seconds)...');
    const iframeEl = q('game-frame');
    iframeHandle = await simSetupIframe(iframeEl);
    populateBranchSelect(iframeHandle.bridge);
    setStatus('Ready. Configure a batch and click Run.');
    return iframeHandle;
  }

  // The same payload shape for the manual Export button and auto-save.
  function buildPayload(){
    return {
      stamp: {
        exportedAt: new Date().toISOString(),
        configHash: iframeHandle ? iframeHandle.bridge.getConfigHash() : null
      },
      results: allResults
    };
  }

  // ── rendering a payload (live batch, loaded history, or import) ──
  // Sets displayedPayload + the "viewing" note, then renders the dashboard.
  // maxRoundHint is the live round count when known (a live batch); otherwise
  // it's resolved from the payload's summary/data by simResolveMaxRound.
  function renderPayload(payload, opts){
    opts = opts || {};
    displayedPayload = payload;
    activeHistoryId = opts.historyId != null ? opts.historyId : null;
    const maxRound = simResolveMaxRound(payload, opts.maxRound);
    simRenderDashboard(q('sim-dashboard'), payload.results || [], maxRound);
    q('sim-viewing').textContent = opts.viewingNote || '';
    q('btn-export').disabled = !(payload.results && payload.results.length);
    highlightActiveHistoryRow();
  }

  // ── history record labels ──
  function fmtWhen(iso){
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '—');
    const p2 = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
      ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function overallWinRate(summary){
    const rates = Object.values(summary.winRateByProfile || {}).filter(v => v != null);
    return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  }
  function histLabel(summary){
    const parts = [summary.branchId || '?', summary.profileInitials || '—',
      (summary.gamesPerProfile != null ? summary.gamesPerProfile + '×' : '?'),
      'seed ' + (summary.baseSeed != null ? summary.baseSeed : '?')];
    return parts.join(' · ') + (summary.source === 'import' ? ' · imported' : '') +
      (summary.partial ? ' · partial' : '');
  }

  // ── history list rendering + wiring ──
  function highlightActiveHistoryRow(){
    document.querySelectorAll('#sim-history-list tr.sim-hist-row').forEach(tr => {
      tr.classList.toggle('active', activeHistoryId != null && Number(tr.dataset.id) === activeHistoryId);
    });
  }

  function renderHistoryList(rows){
    const el = q('sim-history-list');
    q('btn-clear-history').disabled = !rows.length;
    if (!rows.length){
      el.innerHTML = '<div class="sim-muted">No previous runs yet — run a batch or import a file.</div>';
      return;
    }
    let html = '<table class="sim-table"><thead><tr><th>When</th><th>Branch</th><th>Profiles</th>' +
      '<th>Games</th><th>Seed</th><th>Win rate</th><th></th><th></th></tr></thead><tbody>';
    rows.forEach(r => {
      const s = r.summary || {};
      const wr = overallWinRate(s);
      html += '<tr class="sim-hist-row" data-id="' + r.id + '" title="' + simEsc(histLabel(s)) + '">' +
        '<td>' + simEsc(fmtWhen(r.savedAt)) + '</td>' +
        '<td>' + simEsc(s.branchId || '—') + (s.source === 'import' ? ' <span class="sim-muted">(import)</span>' : '') +
          (s.partial ? ' <span class="sim-muted">(partial)</span>' : '') + '</td>' +
        '<td>' + simEsc((s.profiles || []).join(', ') || '—') + '</td>' +
        '<td>' + (s.gamesPerProfile != null ? s.gamesPerProfile : '—') +
          ' <span class="sim-muted">(' + (s.totalGames != null ? s.totalGames : '?') + ')</span></td>' +
        '<td>' + (s.baseSeed != null ? s.baseSeed : '—') + '</td>' +
        '<td>' + (wr == null ? '—' : (Math.round(wr * 10) / 10) + '%') + '</td>' +
        '<td class="sim-hist-load">Load</td>' +
        '<td><button class="sim-del" data-del="' + r.id + '" title="Delete this run">✕</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;

    el.querySelectorAll('tr.sim-hist-row').forEach(tr => {
      tr.addEventListener('click', ev => {
        if (ev.target.closest('button.sim-del')) return; // delete handled separately
        onLoadHistory(Number(tr.dataset.id));
      });
    });
    el.querySelectorAll('button.sim-del').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        onDeleteHistory(Number(btn.dataset.del));
      });
    });
    highlightActiveHistoryRow();
  }

  function refreshHistoryList(){
    return simHistoryList().then(renderHistoryList).catch(err => {
      console.warn('[sim] history list failed', err);
      renderHistoryList([]);
    });
  }

  async function onLoadHistory(id){
    try{
      const rec = await simHistoryGet(id);
      if (!rec || !rec.payload){ setStatus('That run could not be loaded (it may have been deleted).'); return; }
      const s = rec.summary || {};
      renderPayload(rec.payload, {
        historyId: id,
        maxRound: s.maxRound,
        viewingNote: 'Viewing saved run: ' + histLabel(s) + ' — saved ' + fmtWhen(rec.savedAt) +
          ' (not the latest live batch)'
      });
      setStatus('Loaded saved run from ' + fmtWhen(rec.savedAt) + '.');
    }catch(err){
      setStatus('Failed to load run: ' + ((err && err.message) || err));
    }
  }

  async function onDeleteHistory(id){
    try{
      await simHistoryDelete(id);
      if (activeHistoryId === id){ activeHistoryId = null; q('sim-viewing').textContent = ''; }
      await refreshHistoryList();
    }catch(err){
      setStatus('Failed to delete run: ' + ((err && err.message) || err));
    }
  }

  // Two-click confirm (avoids a blocking native confirm dialog).
  let clearArmed = false;
  let clearArmTimer = null;
  async function onClearHistory(){
    const btn = q('btn-clear-history');
    if (!clearArmed){
      clearArmed = true;
      btn.textContent = 'Click again to confirm';
      clearArmTimer = setTimeout(() => { clearArmed = false; btn.textContent = 'Clear all'; }, 4000);
      return;
    }
    clearTimeout(clearArmTimer);
    clearArmed = false;
    btn.textContent = 'Clear all';
    try{
      await simHistoryClear();
      activeHistoryId = null;
      q('sim-viewing').textContent = '';
      await refreshHistoryList();
      setStatus('Previous-runs history cleared.');
    }catch(err){
      setStatus('Failed to clear history: ' + ((err && err.message) || err));
    }
  }

  // Persist a payload into the in-app history, then refresh the list.
  async function recordToHistory(payload, meta){
    try{
      const summary = simBuildRunSummary(meta, payload.results || []);
      await simHistoryAdd({ savedAt: new Date().toISOString(), summary, payload });
      await refreshHistoryList();
    }catch(err){
      console.warn('[sim] could not record run to history', err);
    }
  }

  // ── import a results JSON file ──
  function onImportFile(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let obj;
      try{ obj = JSON.parse(reader.result); }
      catch(e){ setStatus('Import failed: "' + file.name + '" is not valid JSON.'); return; }
      const payload = simValidatePayload(obj);
      if (!payload){ setStatus('Import failed: "' + file.name + '" does not look like simulator results.'); return; }
      const maxRound = simResolveMaxRound(payload, 0);
      renderPayload(payload, { viewingNote: 'Viewing imported file: ' + file.name });
      const cfgHash = (payload.stamp && payload.stamp.configHash) || null;
      await recordToHistory(payload, {
        branchId: (payload.stamp && payload.stamp.branchId) || 'imported',
        profiles: [...new Set(payload.results.map(r => r.profile))],
        gamesPerProfile: null, baseSeed: null, configHash: cfgHash,
        maxRound, partial: false, source: 'import'
      });
      setStatus('Imported ' + payload.results.length + ' game(s) from "' + file.name + '" and added to history.');
    };
    reader.onerror = () => setStatus('Import failed: could not read "' + file.name + '".');
    reader.readAsText(file);
  }

  // ── results-folder UI (File System Access API — see js/sim/store.js) ──
  async function refreshFolderUI(){
    const nameEl = q('folder-name');
    const btn = q('btn-folder');
    if (!simStoreSupported()){
      btn.disabled = true;
      btn.title = 'Requires Chrome (File System Access API)';
      nameEl.textContent = 'not supported in this browser — auto-save downloads instead';
      nameEl.classList.remove('warn');
      return;
    }
    const handle = await simStoreGetDirHandle();
    if (!handle){
      nameEl.textContent = 'no folder chosen — auto-save downloads instead';
      nameEl.classList.remove('warn');
      return;
    }
    const perm = await simQueryDirPermission(handle);
    if (perm === 'granted'){
      nameEl.textContent = handle.name;
      nameEl.classList.remove('warn');
    } else {
      nameEl.textContent = handle.name + ' — permission needed, click the button to re-grant';
      nameEl.classList.add('warn');
    }
  }

  async function initStoreUI(){
    const handle = simStoreSupported() ? await simStoreGetDirHandle() : null;
    // Auto-save defaults ON once a folder has been chosen, OFF otherwise.
    q('chk-autosave').checked = !!handle;
    await refreshFolderUI();
  }

  async function onChooseFolder(){
    if (!simStoreSupported()){
      setStatus('Choosing a folder requires Chrome (File System Access API). Auto-save will use downloads instead.');
      return;
    }
    try{
      // If a stored handle just needs its permission re-granted, this click
      // is the user gesture requestPermission() requires — re-grant in
      // place instead of opening the picker.
      const existing = await simStoreGetDirHandle();
      if (existing && (await simQueryDirPermission(existing)) === 'prompt'){
        const perm = await simRequestDirPermission(existing);
        if (perm === 'granted'){
          await refreshFolderUI();
          setStatus('Folder permission re-granted for "' + existing.name + '".');
          return;
        }
        // declined — fall through and let the user pick a folder instead
      }
      const picked = await window.showDirectoryPicker({ id: 'pf-sim-results', mode: 'readwrite' });
      await simStoreSetDirHandle(picked);
      q('chk-autosave').checked = true;
      await refreshFolderUI();
      setStatus('Results folder set to "' + picked.name + '". Auto-save is ON.');
    }catch(err){
      if (err && err.name === 'AbortError') return; // user cancelled the picker
      setStatus('Folder selection failed: ' + ((err && err.message) || err));
    }
  }

  // Auto-save the finished batch. Returns a status-line note ('' if
  // auto-save is off or there is nothing to save). Never throws.
  async function autoSaveBatch(meta){
    if (!q('chk-autosave').checked || !allResults.length) return '';
    try{
      const json = JSON.stringify(buildPayload(), null, 2);
      const save = await simAutoSaveResults(json, meta);
      if (save.needsRegrant) await refreshFolderUI();
      return ' ' + save.note;
    }catch(err){
      // Belt and braces: simAutoSaveResults already falls back internally.
      return ' WARNING: auto-save failed (' + ((err && err.message) || err) + ') — use Export JSON.';
    }
  }

  async function onRun(){
    if (running) return;
    running = true;
    stopRequested = false;
    activeHistoryId = null;
    q('sim-viewing').textContent = '';
    q('btn-run').disabled = true;
    q('btn-stop').disabled = false;
    q('btn-export').disabled = true;
    try{
      const handle = await ensureIframeReady();
      const branchId = q('sel-branch').value;
      const gamesPerProfile = Math.max(1, Math.min(500, parseInt(q('inp-games').value, 10) || 50));
      const baseSeed = (parseInt(q('inp-seed').value, 10) || 1) >>> 0;
      const profiles = collectProfiles();
      if (!branchId){ setStatus('No branch available — config may not have loaded.'); return; }
      if (!profiles.length){ setStatus('Select at least one bot profile.'); return; }

      const maxRound = handle.bridge.getRCFG().length;
      allResults = [];
      const total = profiles.length * gamesPerProfile;
      setProgress('0 / ' + total);
      setStatus('Running batch: ' + branchId + ', ' + gamesPerProfile + ' games x ' + profiles.length + ' profile(s), base seed ' + baseSeed + '...');

      let lastDoneLine = '0 / ' + total;
      await simRunBatch(handle, { branchId, profiles, gamesPerProfile, baseSeed }, {
        onGameDone(res, done, totalCount){
          allResults.push(res);
          const tail = res.result + (res.failRound != null ? (' @R' + res.failRound) : '');
          lastDoneLine = done + ' / ' + totalCount + '  —  last: ' + res.profile + ' seed=' + res.seed + ' -> ' + tail;
          setProgress(lastDoneLine);
          if (done % 5 === 0 || done === totalCount) simRenderDashboard(q('sim-dashboard'), allResults, maxRound);
        },
        // Per-hand heartbeat — paints thanks to the engine's per-hand yield.
        // If the tab ever stalls again, the last painted text pinpoints the
        // exact game/round/hand where it happened.
        onProgress(p){
          setProgress(lastDoneLine + '  |  running ' + p.profile + ' seed=' + p.seed + '  R' + p.round +
            (p.mod ? ' ' + p.mod : '') + ' hand ' + p.hand);
        },
        shouldStop(){ return stopRequested; }
      });

      simRenderDashboard(q('sim-dashboard'), allResults, maxRound);
      const partial = stopRequested || allResults.length < total;
      const configHash = handle.bridge.getConfigHash();
      // This live batch is now what the dashboard shows and Export writes.
      displayedPayload = buildPayload();
      const saveNote = await autoSaveBatch({
        branchId, profiles, gamesPerProfile, baseSeed,
        configHash, partial, date: new Date()
      });
      // Record to in-app history (always, when there's at least one game) —
      // independent of the folder auto-save toggle above.
      if (allResults.length){
        await recordToHistory(displayedPayload, {
          branchId, profiles, gamesPerProfile, baseSeed,
          configHash, maxRound, partial, source: 'batch'
        });
      }
      setStatus((stopRequested ? 'Stopped early.' : 'Batch complete.') + saveNote);
    }catch(err){
      setStatus('Error: ' + ((err && err.message) || err));
      console.error('[sim] batch error', err);
    }finally{
      running = false;
      q('btn-run').disabled = false;
      q('btn-stop').disabled = true;
      q('btn-export').disabled = allResults.length === 0;
    }
  }

  function onStop(){
    if (!running) return;
    stopRequested = true;
    setStatus('Stopping (takes effect at the next hand)...');
  }

  // Manual export — writes whatever the dashboard currently shows (live batch,
  // a loaded history record, or an imported file).
  function onExport(){
    const payload = displayedPayload || (allResults.length ? buildPayload() : null);
    if (!payload || !payload.results || !payload.results.length){
      setStatus('Nothing to export yet — run a batch, import a file, or load a previous run.');
      return;
    }
    simDownloadTextAsFile('purrfectfit-sim-' + Date.now() + '.json', JSON.stringify(payload, null, 2));
  }

  document.addEventListener('DOMContentLoaded', () => {
    q('btn-run').addEventListener('click', onRun);
    q('btn-stop').addEventListener('click', onStop);
    q('btn-export').addEventListener('click', onExport);
    q('btn-folder').addEventListener('click', onChooseFolder);
    q('btn-import').addEventListener('click', () => q('inp-import').click());
    q('inp-import').addEventListener('change', ev => {
      const file = ev.target.files && ev.target.files[0];
      onImportFile(file);
      ev.target.value = ''; // allow re-importing the same file
    });
    q('btn-clear-history').addEventListener('click', onClearHistory);
    q('btn-stop').disabled = true;
    q('btn-export').disabled = true;
    initStoreUI().catch(err => console.warn('[sim] results-folder init failed', err));
    refreshHistoryList().catch(err => console.warn('[sim] history init failed', err));
    ensureIframeReady().catch(err => setStatus('Error loading game: ' + ((err && err.message) || err)));
  });
})();
