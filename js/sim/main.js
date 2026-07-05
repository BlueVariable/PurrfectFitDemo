'use strict';
// ══════════════════════════════════════════════════════
//  SIM: UI wiring for sim.html
// ══════════════════════════════════════════════════════
(function(){
  let iframeHandle = null; // { win, bridge } — set up once, reused for every batch
  let running = false;
  let stopRequested = false;
  let allResults = [];

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
          setProgress(lastDoneLine + '  |  running ' + p.profile + ' seed=' + p.seed + '  R' + p.round + ' hand ' + p.hand);
        },
        shouldStop(){ return stopRequested; }
      });

      simRenderDashboard(q('sim-dashboard'), allResults, maxRound);
      const partial = stopRequested || allResults.length < total;
      const saveNote = await autoSaveBatch({
        branchId, profiles, gamesPerProfile, baseSeed,
        configHash: handle.bridge.getConfigHash(),
        partial, date: new Date()
      });
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

  // Manual export — unchanged behavior (plain download, original filename).
  function onExport(){
    if (!allResults.length){ setStatus('Nothing to export yet — run a batch first.'); return; }
    simDownloadTextAsFile('purrfectfit-sim-' + Date.now() + '.json', JSON.stringify(buildPayload(), null, 2));
  }

  document.addEventListener('DOMContentLoaded', () => {
    q('btn-run').addEventListener('click', onRun);
    q('btn-stop').addEventListener('click', onStop);
    q('btn-export').addEventListener('click', onExport);
    q('btn-folder').addEventListener('click', onChooseFolder);
    q('btn-stop').disabled = true;
    q('btn-export').disabled = true;
    initStoreUI().catch(err => console.warn('[sim] results-folder init failed', err));
    ensureIframeReady().catch(err => setStatus('Error loading game: ' + ((err && err.message) || err)));
  });
})();
