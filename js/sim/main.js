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
      setStatus(stopRequested ? 'Stopped early.' : 'Batch complete.');
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

  function onExport(){
    if (!allResults.length){ setStatus('Nothing to export yet — run a batch first.'); return; }
    const stamp = {
      exportedAt: new Date().toISOString(),
      configHash: iframeHandle ? iframeHandle.bridge.getConfigHash() : null
    };
    const payload = { stamp, results: allResults };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purrfectfit-sim-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener('DOMContentLoaded', () => {
    q('btn-run').addEventListener('click', onRun);
    q('btn-stop').addEventListener('click', onStop);
    q('btn-export').addEventListener('click', onExport);
    q('btn-stop').disabled = true;
    q('btn-export').disabled = true;
    ensureIframeReady().catch(err => setStatus('Error loading game: ' + ((err && err.message) || err)));
  });
})();
