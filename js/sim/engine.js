'use strict';
// ══════════════════════════════════════════════════════
//  SIM: iframe lifecycle + per-game runner + batch runner
//
//  Lifecycle (see docs/sim.md for the narrative version):
//    1. simSetupIframe(iframeEl) — wait for index.html's own <script> tags
//       to finish loading, inject js/sim/bridge.js INTO the iframe
//       document (see js/sim/bridge.js for why), poll SIM_BRIDGE until
//       TDEFS/RCFG/BRANCHES are populated (config finished its async
//       Google Sheets fetch), then install the two runtime overrides:
//         - runScoreSequence -> immediately calls endScoreSequence(total)
//           (AGENT_PLAYBOOK.md §12 "fast autopilot" bypass — total is
//           already computed by doFit() before the animation, so scoring
//           stays authentic; only the visual sequence is skipped).
//         - markBranchComplete -> no-op, so batch runs never write to the
//           player's REAL localStorage World Map progress ('pf-progress').
//           This is an extra safety measure beyond what the task spec asked
//           for; flagged here and in the report.
//    2. simRunOneGame(...) — for ONE game: seed Math.random, call
//       selectBranch(branchId) (fully resets G), then loop:
//         shop phase (bot.shopPhase) -> startRound() -> hand loop:
//           ensure some hand cat can be placed (else discard, else 'stuck')
//           -> bot.playHand() -> (safety net: force a placement if the bot
//           placed zero cats despite one being possible) -> doFit() ->
//           inspect #win-inline/.visible and #ov-fail/.off to learn the
//           outcome synchronously (endScoreSequence already ran) ->
//           on win: record round metrics, diff the backpack across
//           goShop() to detect lost/expired treats, goShop() to advance;
//           check #ov-branch-win/.off for whole-branch completion.
//    3. simRunBatch(...) — loops profiles x games-per-profile, yielding to
//       the event loop between games (setTimeout 0) so the page/progress
//       UI stays responsive, per the task's "no build tools" browser-only
//       constraint.
// ══════════════════════════════════════════════════════

function simWaitForIframeLoad(iframeEl){
  return new Promise(resolve => {
    if (iframeEl.contentDocument && iframeEl.contentDocument.readyState === 'complete'){ resolve(); return; }
    iframeEl.addEventListener('load', () => resolve(), { once: true });
  });
}

function simInjectBridge(iframeEl){
  return new Promise((resolve, reject) => {
    const win = iframeEl.contentWindow;
    const doc = iframeEl.contentDocument;
    if (win.SIM_BRIDGE){ resolve(win.SIM_BRIDGE); return; }
    const s = doc.createElement('script');
    s.src = 'js/sim/bridge.js';
    s.onload = () => resolve(win.SIM_BRIDGE);
    s.onerror = () => reject(new Error('Failed to load js/sim/bridge.js into the game iframe'));
    (doc.body || doc.head || doc.documentElement).appendChild(s);
  });
}

function simWaitForConfigReady(bridge, timeoutMs){
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll(){
      try{
        const tdefs = bridge.getTDEFS(), rcfg = bridge.getRCFG(), branches = bridge.getBRANCHES();
        if (tdefs && tdefs.length && rcfg && rcfg.length && branches && branches.length){ resolve(); return; }
      }catch(e){ /* transient — game scripts may still be mid-init */ }
      if (Date.now() - start > timeoutMs){ reject(new Error('Timed out waiting for the game config to load (Google Sheets fetch) in the iframe')); return; }
      setTimeout(poll, 100);
    })();
  });
}

// One-time-per-page-load setup. Safe to call once and reuse the returned
// {win, bridge} for an entire session's worth of batches.
async function simSetupIframe(iframeEl){
  await simWaitForIframeLoad(iframeEl);
  const bridge = await simInjectBridge(iframeEl);
  await simWaitForConfigReady(bridge, 20000);
  const win = iframeEl.contentWindow;
  win.runScoreSequence = function(scanResults, boardBonus, boardFull, total, catsSnapshot){
    win.endScoreSequence(total);
  };
  win.markBranchComplete = function(){ /* no-op — see file header */ };
  return { win, bridge };
}

// ── universal "place at least one cat" guarantee ────────────────────────
// doFit() refuses a zero-cat fit, and a hand can occasionally have no cat
// that fits anywhere on the current (re-randomized every hand) board shape.
// Per the task spec: try a discard (bot-flavored pick) when that happens;
// if no discards remain, the game is 'stuck' and the harness aborts it
// rather than looping forever.
function simEnsurePlaceable(win, bridge, bot, rng){
  let guard = 0;
  while (true){
    guard++; if (guard > 30) return false;
    const G = bridge.getG();
    if (!G.hand.length) return false; // nothing left to place at all (deck + hand exhausted)
    if (G.hand.some(cat => simHasAnyLegalPlacement(win, bridge, cat.cells))) return true;
    if (G.disc <= 0) return false;
    const idx = bot.pickDiscardIndex ? bot.pickDiscardIndex(G, rng) : 0;
    win.pickupCat(Math.max(0, Math.min(idx, G.hand.length - 1)));
    win.doDiscard();
  }
}

// Safety net: if a bot's playHand() placed zero cats despite
// simEnsurePlaceable() having confirmed at least one legal placement
// exists, force the first legal placement found so doFit() never aborts.
function simForcePlaceOneCat(win, bridge){
  const G = bridge.getG();
  for (const cat of G.hand){
    const pl = simFindFirstLegalPlacement(win, bridge, cat.cells);
    if (pl){
      const abs = [];
      pl.cells.forEach((row, dr) => row.forEach((v, dc) => { if (v) abs.push([pl.r + dr, pl.c + dc]); }));
      return simPlaceCatAtAbsCells(win, bridge, cat.id, abs);
    }
  }
  return false;
}

// ── per-game runner ──────────────────────────────────────────────────────
function simRunOneGame(win, bridge, branchId, profile, seed){
  const bot = SIM_BOTS[profile];
  if (!bot) throw new Error('Unknown bot profile: ' + profile);
  const result = { profile, seed, branchId, result: null, failRound: null, error: null, rounds: [] };
  try{
    win.Math.random = simMulberry32(seed);
    const rng = simRngStream((seed ^ 0x9e3779b9) >>> 0); // independent stream for bot decisions
    win.selectBranch(branchId);

    // Defensive overlay reset. The game only clears these via real-UI
    // buttons the sim never clicks: #ov-branch-win stays visible after
    // showBranchWin() until closeBranchWin() (which also navigates away, so
    // we must not call it), and #ov-fail stays visible after roundFail()
    // until restart(). selectBranch() fully resets G but does NOT touch
    // these overlays — left stale, every later game in the batch would
    // misread the previous game's outcome as its own after its first fit.
    // #win-inline is cleared by goShop(), which the sim does call, but is
    // reset here too in case the previous game crashed mid-round.
    const doc0 = win.document;
    doc0.getElementById('ov-branch-win').classList.add('off');
    doc0.getElementById('ov-fail').classList.add('off');
    const wi0 = doc0.getElementById('win-inline');
    wi0.classList.remove('visible');
    wi0.style.display = 'none';

    let guardRounds = 0;
    while (true){
      guardRounds++;
      if (guardRounds > 200) throw new Error('Round loop exceeded 200 iterations — likely an infinite loop');

      const Gstart = bridge.getG();
      const roundNum = Gstart.round;
      const roundLog = {
        round: roundNum, target: Gstart.tgt, finalScore: null, handsUsed: 0, discardsUsed: 0,
        purrfectCount: 0, cashAfterShop: null, treatsBought: [], treatsFailedBuy: [], treatsLostExpired: []
      };
      const ctx = { win, bridge, rng, roundLog };

      // ---- shop phase ----
      bot.shopPhase(ctx);
      roundLog.cashAfterShop = bridge.getG().cash;
      win.startRound();

      // ---- hand loop ----
      let outcome = null; // 'won' | 'failed' | 'stuck'
      let handGuard = 0;
      while (true){
        handGuard++;
        if (handGuard > 100) throw new Error('Hand loop exceeded 100 iterations within round ' + roundNum);

        const maxHands = bridge.getG().maxHands;
        if (!simEnsurePlaceable(win, bridge, bot, rng)){ outcome = 'stuck'; break; }

        bot.playHand(ctx);
        if (bridge.getG().cats.length === 0) simForcePlaceOneCat(win, bridge);

        // Snapshot backpack state before a potentially round-ending fit, so
        // a win can be diffed across goShop()'s restore step below.
        const preFitBpIds = simIdMultiset(bridge.getG().bpGroups, g => g.tdef.id);

        win.doFit();

        const doc = win.document;
        const wonVisible = doc.getElementById('win-inline').classList.contains('visible');
        const failVisible = !doc.getElementById('ov-fail').classList.contains('off');

        if (wonVisible){
          const G = bridge.getG();
          roundLog.handsUsed = maxHands - G.hands;
          roundLog.discardsUsed = G.discUsedRound || 0;
          roundLog.purrfectCount = G.purrfectsThisRound || 0;
          roundLog.finalScore = G.score;

          const usedThisRound = (G.usedTreats || []).slice();
          const expiredIds = usedThisRound.filter(td => td._expired).map(td => td.id);
          const nonExpiredCounts = simIdMultiset(usedThisRound.filter(td => !td._expired), td => td.id);
          const expectedAfter = Object.assign({}, preFitBpIds);
          Object.keys(nonExpiredCounts).forEach(id => { expectedAfter[id] = (expectedAfter[id] || 0) + nonExpiredCounts[id]; });

          win.goShop();

          const actualAfter = simIdMultiset(bridge.getG().bpGroups, g => g.tdef.id);
          const lostToFragmentation = [];
          Object.keys(expectedAfter).forEach(id => {
            const have = actualAfter[id] || 0;
            const want = expectedAfter[id];
            for (let i = have; i < want; i++) lostToFragmentation.push(id);
          });
          roundLog.treatsLostExpired = expiredIds.concat(lostToFragmentation);

          outcome = 'won';
          break;
        }
        if (failVisible){
          const G = bridge.getG();
          roundLog.handsUsed = maxHands - G.hands;
          roundLog.discardsUsed = G.discUsedRound || 0;
          roundLog.purrfectCount = G.purrfectsThisRound || 0;
          roundLog.finalScore = G.score;
          outcome = 'failed';
          break;
        }
        // else: round continues, dealHand() already ran synchronously inside endScoreSequence
      }

      result.rounds.push(roundLog);

      if (outcome === 'failed'){ result.result = 'failRound'; result.failRound = roundNum; break; }
      if (outcome === 'stuck'){ result.result = 'stuck'; result.failRound = roundNum; break; }

      const branchWon = !win.document.getElementById('ov-branch-win').classList.contains('off');
      if (branchWon){ result.result = 'won'; break; }
      // else: goShop() already advanced to the next round's shop screen — loop.
    }
  }catch(err){
    result.result = 'crashed';
    result.error = (err && err.message) || String(err);
    if (result.failRound === null) result.failRound = result.rounds.length ? result.rounds[result.rounds.length - 1].round + 1 : 1;
  }
  return result;
}

// ── batch runner ─────────────────────────────────────────────────────────
// opts: { branchId, profiles:[...], gamesPerProfile, baseSeed }
// callbacks: { onGameDone(result, doneCount, totalCount), shouldStop() }
async function simRunBatch(handle, opts, callbacks){
  const { win, bridge } = handle;
  const { branchId, profiles, gamesPerProfile, baseSeed } = opts;
  const { onGameDone, shouldStop } = callbacks || {};
  const results = [];
  const total = profiles.length * gamesPerProfile;
  let done = 0;
  for (const profile of profiles){
    for (let i = 0; i < gamesPerProfile; i++){
      if (shouldStop && shouldStop()) return results;
      const seed = simDeriveSeed(baseSeed, profile, i);
      const res = simRunOneGame(win, bridge, branchId, profile, seed);
      results.push(res);
      done++;
      if (onGameDone) onGameDone(res, done, total);
      await new Promise(r => setTimeout(r, 0)); // yield so the page stays responsive
    }
  }
  return results;
}
