'use strict';
// ══════════════════════════════════════════════════════
//  SCORING — scan-order animated sequence
//  Pieces (cats + treats) are processed top-left → bottom-right.
//  A piece's "trigger cell" is its topmost-then-leftmost cell.
//  When a cat fires: buffered treat effects are applied, score locked in.
//  When a treat fires: its result is buffered for future cats.
// ══════════════════════════════════════════════════════

// ── Round-modifier (boss round) pure effect helpers used by doFit() ──
// Kept pure (mod passed explicitly) so they're easy to unit-test in isolation.
function catBaseScore(cellCount,catType,mod){
  if(mod&&mod.effect==='type_mult'&&mod.type&&catType===mod.type)
    return cellCount*10*(mod.mag||2);
  return cellCount*10;
}
function boardFillBonus(playableCells,perCell,mod){
  const base=playableCells*perCell;
  if(mod&&mod.effect==='fill_bonus_mult')return Math.round(base*(mod.mag||1));
  return base;
}
// Comparator for allPieces.sort — normally row-major ascending (topmost-then-
// leftmost trigger cell fires first). mirror_mood (scan_reverse) inverts it so
// the scan runs bottom-right → top-left instead. Shared verbatim by doFit() and
// projection.js's projectScore() so the two stay in sync under the modifier.
function scanCompare(a,b,mod){
  if(mod&&mod.effect==='scan_reverse')
    return(b.trigger[0]-a.trigger[0])||(b.trigger[1]-a.trigger[1]);
  return(a.trigger[0]-b.trigger[0])||(a.trigger[1]-b.trigger[1]);
}

function doFit(){
  if(!G.cats.length)return;

  // Restore any requirements disabled by jumping_ball in the previous hand
  TDEFS.forEach(td=>{if(td._origReq!==undefined){td.req=td._origReq;delete td._origReq;}});

  // Per-fit cleanup hooks: treats whose effect must revert when the fit ends
  // (e.g. milk_bar's temporary type override) push a restore closure here from
  // their fn(); all run LIFO right after the scan loop below. Re-initialized
  // every fit so closures registered during projectScore() scans (projection
  // restores all state itself in its finally) are discarded, never executed.
  G._fitCleanups=[];

  // Trigger cell = topmost then leftmost cell of a piece
  function triggerCell(cells){
    return cells.reduce((best,[r,c])=>
      (r<best[0]||(r===best[0]&&c<best[1]))?[r,c]:best
    ,[Infinity,Infinity]);
  }

  // Build unified sorted list of all pieces (cats + treats)
  const allPieces=[
    ...G.cats.map(cat=>({kind:'cat',piece:cat,trigger:triggerCell(cat.cells)})),
    ...G.treats.map(treat=>({kind:'treat',piece:treat,trigger:triggerCell(treat.cells)}))
  ];
  allPieces.sort((a,b)=>scanCompare(a,b,G.roundModifier));

  const catScores={};
  const scoredGids=new Set();
  const treatBuffer=[]; // {treat, result, phase} — effects waiting to apply to future cats
  const scanResults=[]; // passed to animation
  let runningTotal=0;

  for(const item of allPieces){
    if(item.kind==='cat'){
      const cat=item.piece;
      const base=catBaseScore(cat.cells.length,cat.type,G.roundModifier);
      let addBonus=0;
      let mulFactor=1;
      // Apply buffered treats: sum all add bonuses, then compound all mul factors
      for(const buf of treatBuffer){
        addBonus+=getAddBonusForCat(buf,cat);
        const m=getMulFactorForCat(buf,cat);
        if(m!==1)mulFactor*=m;
      }
      const score=Math.round((base+addBonus)*mulFactor);
      catScores[cat.gid]=score;
      scoredGids.add(cat.gid);
      runningTotal+=score;
      scanResults.push({kind:'cat',piece:cat,score,base,addBonus,mulFactor});
    }else{
      const treat=item.piece;
      if(treat.tdef.req&&requirementFails(treat.tdef.req)){
        scanResults.push({kind:'treat',piece:treat,result:{skip:true},phase:treat.tdef.phase,skipped:true});
        continue;
      }
      // Pass future cats and a copy of current scores so fn() can't mutate locked cat scores
      const futureCats=G.cats.filter(c=>!scoredGids.has(c.gid));
      const csCopy=Object.assign({},catScores);
      const result=treat.tdef.fn(G.board,futureCats,G.treats,treat.cells,csCopy)||{};

      const hasImmediate=result.scoreMultiplier||result.scoreBonus!==undefined;
      if(result.scoreMultiplier){
        // Type B mul: apply to running total directly
        result.prevTotal=runningTotal;
        runningTotal=Math.round(runningTotal*result.m);
        result.newTotal=runningTotal;
      }
      if(result.scoreBonus!==undefined){
        // Type B add: apply to running total directly
        if(result.prevTotal===undefined)result.prevTotal=runningTotal;
        runningTotal+=result.scoreBonus;
        result.newTotal=runningTotal;
      }
      // Buffer for future cats unless this is a pure Type B result with nothing
      // else to buffer. treat_encore sets _alsoBuffer because it can carry an
      // immediate scoreBonus/scoreMultiplier (from retriggered Type B treats)
      // AND a bonusMap/mulMap (from retriggered Type A treats) at the same time.
      if(!hasImmediate||result._alsoBuffer){
        if(treat.tdef.phase==='add'){
          result._affectedGids=futureCats
            .filter(cat=>getAddBonusForCat({treat,result,phase:treat.tdef.phase},cat)>0)
            .map(cat=>cat.gid);
        }
        treatBuffer.push({treat,result,phase:treat.tdef.phase});
      }
      scanResults.push({kind:'treat',piece:treat,result,phase:treat.tdef.phase});
    }
  }

  // The scan is over — run per-fit cleanups LIFO so stacked overrides (two
  // milk_bars in one fit) unwind in reverse registration order.
  for(let i=G._fitCleanups.length-1;i>=0;i--)G._fitCleanups[i]();
  G._fitCleanups=[];

  // Board fill bonus
  const filledCells=G.board.flat().filter(c=>c.filled).length;
  const playableCells=G.board.flat().filter(c=>!c.blocked&&!c.offShape).length;
  const boardFull=filledCells===playableCells&&playableCells>0;
  const boardBonus=boardFull?boardFillBonus(playableCells,CFG.board_fill_bonus||5,G.roundModifier):0;
  G.totalFits=(G.totalFits||0)+1;
  // Run-level cumulative count of cats scored — persists across hands AND rounds
  // (reset only by newGame). big_bite reads it so its decay carries over the whole
  // run. Incremented here, in the real fit only; projectScore() has its own scan
  // and never reaches this line, so projections don't advance the counter.
  G.catsScoredRun=(G.catsScoredRun||0)+scoredGids.size;
  if(boardFull){G.totalPurrfects=(G.totalPurrfects||0)+1;G.purrfectsThisRound=(G.purrfectsThisRound||0)+1;}

  // Feature 3 — purrfect streak + near-miss TRACKING lives here (not in
  // runScoreSequence) so it still advances when the sim replaces
  // runScoreSequence with a stub that calls endScoreSequence(total) directly.
  // Resets to 0 on any non-purrfect fit; not persisted across games since
  // newGame() (state.js) replaces G wholesale rather than merging into it.
  G.purrfectStreak=boardFull?(G.purrfectStreak||0)+1:0;
  const cellsUnfilled=playableCells-filledCells;

  const total=runningTotal+boardBonus;
  G.lastScore=total;

  // TAX SEASON round modifier: every treat played this fit costs cash.
  // mod.mag is the per-treat cash delta (e.g. -1). Cash may go negative —
  // nothing clamps it, matching the modifier's "cash can go negative".
  // Applied here in the committed fit only; projectScore() has its own scan
  // and never runs this, so score previews stay tax-free.
  const _taxMod=G.roundModifier;
  if(_taxMod&&_taxMod.effect==='treat_tax'&&G.treats.length){
    G.cash+=(_taxMod.mag||0)*G.treats.length;
  }

  const catsSnapshot=[...G.cats];

  // Lifecycle: each placed treat normally moves to G.usedTreats (removed from
  // the inventory for the rest of the round, restored at round end via
  // bpRestoreUsedTreats in goShop()). Treats whose Additional Effects text
  // contains "REAPPEAR" get a 1-in-2 chance, flipped per placed instance, to
  // skip that and go straight back into the inventory instead — available
  // again for the NEXT HAND of the same round. On the failed flip (or if the
  // backpack genuinely has no room for it even with rotation) it falls back
  // to the normal usedTreats path. It never permanently disappears.
  G.treats.forEach(bt=>{
    bt.cells.forEach(([r,c])=>{G.board[r][c]=emptyCell();});
    if(bt.tdef.addEf&&/REAPPEAR/i.test(bt.tdef.addEf)&&Math.random()<0.5){
      if(bpAutoPlaceRot(bt.tdef)){
        // Tag the matching scanResults entry (matched by instance, not id, so
        // duplicate copies of the same treat flip independently) so the
        // animation log can announce the bounce-back.
        const entry=scanResults.find(sr=>sr.kind==='treat'&&sr.piece===bt);
        if(entry)entry.reappeared=true;
        return; // back in the backpack immediately — no usedTreats entry
      }
    }
    G.usedTreats.push(bt.tdef);
  });
  G.treats=[];

  runScoreSequence(scanResults,boardBonus,boardFull,total,catsSnapshot,cellsUnfilled);
}

// ── Compute add bonus from one buffered treat for a specific future cat ──
function getAddBonusForCat(buf,cat){
  const{treat,result,phase}=buf;
  if(phase==='add'){
    if(result.bonusMap)return result.bonusMap[cat.gid]||0;
    if(!result.bonus)return 0;
    const ef=treat.tdef.ef;
    const amt=extractNum(ef);
    const treatCells=treat.cells;
    const[tRow,tCol]=treatCells[0];
    let hit=false;
    if(ef.includes('ALL'))hit=true;
    else if(ef.includes('ROW'))hit=cat.cells.some(([r])=>r===tRow);
    else if(ef.includes('COL'))hit=cat.cells.some(([,c])=>c===tCol);
    else if(ef.includes('SURR')||ef.includes('surrounding'))
      hit=treatCells.some(([tr,tc])=>cat.cells.some(([r,c])=>Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
    else hit=true;
    return hit?amt:0;
  }
  if(phase==='x'){
    if(result.subPhase==='add'&&result.result){
      const r2=result.result;
      if(r2.bonusMap)return r2.bonusMap[cat.gid]||0;
      if(!r2.bonus)return 0;
      const ef2=result.copiedFrom.ef;
      const amt2=extractNum(ef2);
      const cells2=result.laserCells;
      const[tRow2,tCol2]=cells2[0];
      let hit2=false;
      if(ef2.includes('ALL'))hit2=true;
      else if(ef2.includes('ROW'))hit2=cat.cells.some(([r])=>r===tRow2);
      else if(ef2.includes('COL'))hit2=cat.cells.some(([,c])=>c===tCol2);
      else if(ef2.includes('SURR')||ef2.includes('surrounding'))
        hit2=cells2.some(([tr,tc])=>cat.cells.some(([r,c])=>Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
      else hit2=true;
      return hit2?amt2:0;
    }
    if(result.subPhase==='mirror')return result.bonusMap?.[cat.gid]||0;
  }
  return 0;
}

// ── Compute mul factor from one buffered treat for a specific future cat ──
function getMulFactorForCat(buf,cat){
  const{result,phase}=buf;
  if(phase==='mul'){
    if(result.gids&&result.gids.includes(cat.gid)&&result.m>1)return result.m;
    return 1;
  }
  if(phase==='x'){
    if(result.subPhase==='mul'&&result.result){
      if(result.result.gids&&result.result.gids.includes(cat.gid)&&result.result.m>1)return result.result.m;
    }
    if(result.subPhase==='mirror'&&result.mulMap&&result.mulMap[cat.gid]>1)return result.mulMap[cat.gid];
    if(result.luckyGid===cat.gid)return 4;
    if(result.halvedGids&&result.halvedGids.includes(cat.gid))return 0.5;
  }
  return 1;
}

// ── Scan-order animation ──
function runScoreSequence(scanResults,boardBonus,boardFull,total,catsSnapshot,cellsUnfilled){
  const seq=g('ov-score-seq');
  seq.innerHTML='';
  seq.classList.add('active');

  const boardEl=g('board');
  const firstCell=boardEl.children[0]?.getBoundingClientRect();
  if(!firstCell){endScoreSequence(total);return;}
  const cellW=firstCell.width;
  const labelW=Math.max(32,Math.min(48,cellW*.75));
  const labelH=Math.max(20,Math.min(30,cellW*.45));
  const labelFS=Math.max(9,Math.min(14,cellW*.22));

  const dim=document.createElement('div');
  dim.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:-1;';
  seq.appendChild(dim);

  // One centered label per cat group, revealed when the cat fires
  const grpMap={};
  catsSnapshot.forEach(grp=>{grpMap[grp.gid]={cells:grp.cells,els:[]};});

  catsSnapshot.forEach(grp=>{
    const rs=grp.cells.map(([r])=>r),cs=grp.cells.map(([,c])=>c);
    const minR=Math.min(...rs),maxR=Math.max(...rs);
    const minC=Math.min(...cs),maxC=Math.max(...cs);
    const tlEl=boardEl.children[minR*G.bsc+minC];
    const brEl=boardEl.children[maxR*G.bsc+maxC];
    if(!tlEl||!brEl)return;
    const tlRect=tlEl.getBoundingClientRect();
    const brRect=brEl.getBoundingClientRect();
    const centerX=(tlRect.left+brRect.right)/2;
    const centerY=(tlRect.top+brRect.bottom)/2;
    const lbl=document.createElement('div');
    lbl.className='score-cell-label';
    lbl.style.left=(centerX-labelW/2)+'px';
    lbl.style.top=(centerY-labelH/2)+'px';
    lbl.style.width=labelW+'px';lbl.style.height=labelH+'px';lbl.style.fontSize=labelFS+'px';
    lbl.textContent='';
    lbl.dataset.gid=grp.gid;
    seq.appendChild(lbl);
    grpMap[grp.gid].els=[lbl];
  });

  const scoreEl=g('g-score');
  const scoreCard=scoreEl?.closest('.card');
  const baseScoreBeforeHand=G.score;
  let displayedScore=0;
  let _counterIv=null;
  const tbScoreEl=g('g-topbar-score');
  function syncTopbarScore(val){if(tbScoreEl)tbScoreEl.querySelector('span').textContent=val;}
  function animateCounter(targetScore,duration){
    if(!scoreEl)return;
    if(_counterIv){clearInterval(_counterIv);_counterIv=null;}
    const start=displayedScore,diff=targetScore-start;
    if(diff<=0){const v=(baseScoreBeforeHand+targetScore).toLocaleString();scoreEl.textContent=v;syncTopbarScore(v);displayedScore=targetScore;return;}
    const steps2=Math.min(30,Math.ceil(duration/16));let step=0;
    if(scoreCard){scoreCard.classList.remove('score-card-lit');void scoreCard.offsetWidth;scoreCard.classList.add('score-card-lit');}
    _counterIv=setInterval(()=>{
      step++;displayedScore=Math.round(start+diff*(step/steps2));
      const v=(baseScoreBeforeHand+displayedScore).toLocaleString();
      if(scoreEl)scoreEl.textContent=v;syncTopbarScore(v);
      if(step>=steps2){clearInterval(_counterIv);_counterIv=null;displayedScore=targetScore;const vf=(baseScoreBeforeHand+targetScore).toLocaleString();if(scoreEl)scoreEl.textContent=vf;syncTopbarScore(vf);}
    },Math.ceil(duration/steps2));
  }

  const logDiv=document.createElement('div');logDiv.className='seq-log';seq.appendChild(logDiv);
  const banner=document.createElement('div');banner.className='score-total-banner';
  banner.textContent='+'+total.toLocaleString();seq.appendChild(banner);

  const stepExplain=document.createElement('div');
  stepExplain.style.cssText='position:fixed;bottom:calc(12% + 60px);left:50%;transform:translateX(-50%);z-index:403;text-align:center;font-family:\'Fredoka One\',cursive;font-size:14px;color:rgba(255,255,255,.8);max-width:340px;width:90%;background:rgba(26,34,54,.88);border-radius:14px;padding:10px 18px;';
  if(!DEV_MODE)stepExplain.style.display='none';
  seq.appendChild(stepExplain);

  const nextBtn=document.createElement('button');
  nextBtn.style.cssText='position:fixed;bottom:12%;left:50%;transform:translateX(-50%);z-index:404;padding:12px 36px;border:none;cursor:pointer;background:#fff;color:var(--tx);font-family:\'Fredoka One\',cursive;font-size:16px;border-radius:50px;box-shadow:0 4px 0 rgba(0,0,0,.2);';
  nextBtn.textContent='Next →';
  if(!DEV_MODE)nextBtn.style.display='none';
  seq.appendChild(nextBtn);

  const steps=[];
  let runningTotal=0;

  scanResults.forEach(item=>{
    if(item.kind==='cat'){
      const{piece:cat,score,base,addBonus,mulFactor}=item;
      const info=grpMap[cat.gid];
      runningTotal+=score;
      const capturedTotal=runningTotal;

      let desc='';
      if(addBonus>0&&mulFactor!==1)desc=` (${base}+${addBonus})×${mulFactor}`;
      else if(addBonus>0)desc=` (${base}+${addBonus})`;
      else if(mulFactor!==1)desc=` (${base}×${mulFactor})`;

      steps.push({
        kind:'cat',
        explain:`🐱 scored +${score}`,
        run(){
          flashTreat(seq,boardEl,{cells:cat.cells},G.bsc);
          if(info){
            const lbl=info.els[0];
            if(lbl){
              lbl.textContent='+'+score;
              lbl.classList.add('show');
              lbl.style.background='rgba(245,166,35,.85)';
              lbl.classList.add('boosted');
              setTimeout(()=>{lbl.classList.remove('boosted');lbl.style.background='';},700);
            }
          }
          animateCounter(capturedTotal,500);
          addLogLine(logDiv,`🐱 +${score}${desc}`);
        }
      });
    }else{
      const{piece:treat,result,phase,skipped,reappeared}=item;
      if(skipped){
        steps.push({
          kind:'treat',
          explain:`${treat.tdef.em} ${treat.tdef.nm}: req not met`,
          run(){
            let line=`${treat.tdef.em} ${treat.tdef.nm}: req not met`;
            if(reappeared)line+=' ... and it bounces back to your bag! 🎉';
            addLogLine(logDiv,line);
          }
        });
        return;
      }

      // Sync local runningTotal for Type B treats so subsequent cat animateCounter calls don't drop.
      // result.newTotal (set by doFit) already reflects mul-then-add combined, so trust it directly.
      if(result.newTotal!==undefined){
        runningTotal=result.newTotal;
      }

      // Build log line describing what this treat does.
      // NOTE: treat.tdef.phase reflects the sheet's "Phase" column, which for
      // every laser/encore/piggy_bank/zoomies/dice-style "special effect"
      // treat is literally the string 'misc' — NOT 'x'. The final `else`
      // branch below is therefore the one that actually runs for all of
      // those treats; keep it as the catch-all rather than re-keying on 'x'.
      let logLine=`${treat.tdef.em} ${treat.tdef.nm}`;
      if(phase==='add'){
        if(result.bonusMap){
          const futureBonus=Object.values(result.bonusMap).reduce((a,b)=>a+b,0);
          if(futureBonus>0)logLine+=`: +${futureBonus} buffered`;
          else logLine+=`: no cats in range`;
        }else if(result.bonus>0){
          logLine+=`: +${extractNum(treat.tdef.ef)} buffered`;
        }else if(result.scoreBonus!==undefined){
          logLine+=`: +${result.scoreBonus}`;
        }else{
          logLine+=`: no bonus this trigger`;
        }
      }else if(phase==='mul'){
        if(result.gids&&result.gids.length&&result.m>1)
          logLine+=`: ×${result.m} (${result.gids.length} cat${result.gids.length!==1?'s':''} ahead)`;
        else if(result.scoreBonus!==undefined)
          logLine+=`: +${result.scoreBonus}`;
        else if(treat.tdef.id==='second_wind')
          logLine+=`: +1 hand this round!`;
        else if(treat.tdef.id==='wild_dice')
          logLine+= result.m>1?`: rolled a hit — ×${result.m}!`:`: rolled a miss (1-in-6)`;
        else if(result.scoreMultiplier&&result.m!==1)
          logLine+=`: ×${result.m}`;
        else if(result.scoreMultiplier)
          logLine+=`: no effect this trigger`;
        else if(result.gids)
          logLine+=`: no cats in range`;
        else
          logLine+=`: no effect this trigger`;
      }else{
        // Catch-all for phase 'misc' (and any literal 'x') — laser, encore,
        // jumping_ball, standing_ovation, zoomies, brownies, sardine_tin,
        // piggy_bank/lucky_penny/coin_purse/gift_wrap, loaded_dice, etc.
        const em=treat.tdef.em;
        if(result.skip){
          const skipMsgs={
            laser:'nothing to copy',
            encore:'nothing to retrigger',
            treat_encore:'nothing to retrigger',
            jumping_ball:'no requirement to disable',
            standing_ovation:'nothing to duplicate',
          };
          logLine+=` — ${skipMsgs[treat.tdef.id]||'no valid target'}`;
        }
        else if(result.scoreMultiplier&&result.m>1)
          logLine+=`: copied ${result.copiedFrom?.em||em} ${result.copiedFrom?.nm||''} ×${result.m}`;
        else if(result.scoreMultiplier&&result.copiedFrom?.id==='wild_dice')
          logLine+=`: rolled a miss (1-in-6)`;
        else if(result.scoreMultiplier&&result.copiedFrom?.id==='second_wind')
          logLine+=`: copied ${result.copiedFrom.em} ${result.copiedFrom.nm} +1 hand this round!`;
        else if(result.scoreMultiplier&&result.copiedFrom)
          logLine+=`: copied ${result.copiedFrom.em} ${result.copiedFrom.nm} (no effect this trigger)`;
        else if(result.scoreBonus!==undefined&&result.copiedFrom)
          logLine+=`: copied ${result.copiedFrom.em} ${result.copiedFrom.nm} +${result.scoreBonus}`;
        else if(result.subPhase==='add'||result.subPhase==='mul'){
          let n;
          if(result.subPhase==='mul'&&result.result&&result.result.gids)n=result.result.gids.length;
          else if(result._affectedGids)n=result._affectedGids.length;
          logLine+=`: re-fired ${result.copiedFrom?.em||''} ${result.copiedFrom?.nm||''} — buffered${n!==undefined?` for ${n} cat${n!==1?'s':''}`:''}`;
        }
        else if(result.subPhase==='mirror'){
          logLine+=`: mirror +${result.totalBonus||0}`;
          if(result.scoreBonus)logLine+=` +${result.scoreBonus}`;
          if(result.scoreMultiplier&&result.m!==1)logLine+=` ×${result.m}`;
        }
        else if(result.luckyGid)logLine+=`: ×4 lucky, ×½ others`;
        else if(result.disabledTreat)logLine+=`: disabled req for ${result.disabledTreat.em} ${result.disabledTreat.nm}`;
        else if(result.addedCatEm!==undefined)logLine+=`: added ${result.addedCatEm} ${result.addedCatName} to deck`;
        else if(result.transformedInto)logLine+=`: transformed → ${result.transformedInto.em} ${result.transformedInto.nm}`;
        else if(result.convertedGid)logLine+=`: converted ${result.oldType} → ${result.convertedEm} ${result.newType}`;
        else if(result.destroyedCat)logLine+=`: removed ${result.destroyedCat.em} ${result.destroyedCat.name}`;
        else if(result.duplicatedTreat)logLine+=`: duplicated ${result.duplicatedTreat.em} ${result.duplicatedTreat.nm}`;
        else if(result.charging)logLine+=`: charging ${result.charging}`;
        else if(result.cashGained)logLine+=`: +$${result.cashGained} to your wallet`;
        else if(result.zoomiesCleared!==undefined)logLine+=`: cleared ${result.zoomiesCleared} blocked cell${result.zoomiesCleared!==1?'s':''}`;
        else if(result.announce!==undefined)logLine+=`: ${result.announce}`;
        else logLine+=`: triggered`;
      }
      if(reappeared)logLine+=' ... and it bounces back to your bag! 🎉';

      steps.push({
        kind:'treat',
        explain:`${treat.tdef.em} ${treat.tdef.nm}: "${treat.tdef.ef}"`,
        run(){
          flashTreat(seq,boardEl,treat,G.bsc);
          addLogLine(logDiv,logLine);

          // These are independent ifs (not else-if) because treat_encore can carry both an
          // immediate scoreMultiplier AND scoreBonus at once (compounded from retriggered
          // Type B treats) — both animations should play, in that order.
          if(result.scoreMultiplier&&result.m!==1){
            // Type B mul: score slam (any phase — x-phase treats like laser/encore/loaded_dice may propagate this)
            animateScoreSlam(scoreEl,result.newTotal,baseScoreBeforeHand);
            displayedScore=result.newTotal;
          }
          if(result.scoreBonus!==undefined){
            // Type B add: floating badge (any phase — e.g. big_bite is x-phase)
            const sign=result.scoreBonus>=0?'+':'';
            animateScoreFloatBadge(seq,scoreEl,sign+result.scoreBonus,baseScoreBeforeHand,result.newTotal);
            displayedScore=result.newTotal;
          }
          if(!result.scoreMultiplier&&result.scoreBonus===undefined){
            if(phase==='mul'&&result.gids&&result.gids.length){
              // Type A mul: gold pulse on matching cats
              flashCatCells(seq,boardEl,result.gids,catsSnapshot,G.bsc,'mul');
            }else if(phase==='add'&&result._affectedGids&&result._affectedGids.length){
              // Type A add: cyan pulse on affected cats
              flashCatCells(seq,boardEl,result._affectedGids,catsSnapshot,G.bsc,'add');
            }
          }
        }
      });
    }
  });

  // Final step: board bonus + total banner
  const finalCatTotal=runningTotal;
  const finalEndDelay=(boardBonus>0?700:0)+1200;
  steps.push({
    kind:'final',
    explain:`🏆 Final total: +${total.toLocaleString()} pts this hand.`,
    endDelay:finalEndDelay,
    run(){
      // Feature 3 — visual-only celebration/consolation callout. Tracking
      // (G.purrfectStreak / boardFull / cellsUnfilled) already happened in
      // doFit(); this just decides which banner (if any) to pop.
      if(boardFull&&G.purrfectStreak>=2){
        showStreakCallout(seq,G.purrfectStreak);
      }else if(!boardFull&&cellsUnfilled===1){
        showNearMissCallout(seq);
      }
      if(boardBonus>0){
        addLogLine(logDiv,`✨ Board Filled! +${boardBonus}`);
        animateCounter(finalCatTotal+boardBonus,700);
      }
      setTimeout(()=>{
        addLogLine(logDiv,`🏆 Total: +${total.toLocaleString()}`);
        banner.textContent='+'+total.toLocaleString();
        banner.classList.add('show');
      },boardBonus>0?700:250);
    },
    isLast:true
  });

  let stepIdx=-1;
  function runNextStep(){
    stepIdx++;
    if(stepIdx>=steps.length){endScoreSequence(total);return;}
    const step=steps[stepIdx];
    if(stepExplain)stepExplain.textContent=step.explain||'';
    setTimeout(()=>step.run(),120);
    if(DEV_MODE){
      nextBtn.textContent=step.isLast?'Finish ✓':'Next →';
      nextBtn.onclick=step.isLast?()=>endScoreSequence(total):runNextStep;
    }else{
      const delay=step.isLast?(step.endDelay||2400):step.kind==='treat'?550:750;
      if(step.isLast)setTimeout(()=>endScoreSequence(total),delay);
      else setTimeout(runNextStep,delay);
    }
  }
  runNextStep();
}

// Feature 3 — escalating "PURRFECT xN!" callout for a streak of >=2 consecutive
// purrfect fits. Guarded by callers checking `seq` already exists.
function showStreakCallout(seq,streak){
  const el=document.createElement('div');
  el.className='streak-callout';
  const bangs='!'.repeat(Math.min(3,1+Math.floor((streak-2)/2)));
  el.textContent=`PURRFECT x${streak}${bangs}`;
  seq.appendChild(el);
  setTimeout(()=>el.classList.add('show'),20);
  setTimeout(()=>el.remove(),1500);
}
// Feature 3 — "one cell left" near-miss consolation callout.
function showNearMissCallout(seq){
  const el=document.createElement('div');
  el.className='near-miss-callout';
  el.innerHTML='😿 SO CLOSE — one cell left!';
  seq.appendChild(el);
  setTimeout(()=>el.classList.add('show'),20);
  setTimeout(()=>el.remove(),1500);
}

function flashTreat(seq,boardEl,treat,bsc){
  treat.cells.forEach(([tr,tc])=>{
    const el=boardEl.children[tr*bsc+tc];
    if(!el)return;
    const flash=document.createElement('div');
    flash.className='score-treat-flash';
    const rect=el.getBoundingClientRect();
    flash.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-radius:8px;border:3px solid #fff;box-shadow:0 0 18px 6px rgba(255,220,60,.7);pointer-events:none;opacity:0;transition:opacity .2s;`;
    seq.appendChild(flash);
    setTimeout(()=>flash.style.opacity='1',20);
    setTimeout(()=>flash.style.opacity='0',600);
    setTimeout(()=>flash.remove(),900);
  });
}

function flashCatCells(seq,boardEl,gids,catsSnapshot,bsc,phase){
  const pulseClass=phase==='add'?'cat-pulse-add':'cat-pulse-mul';
  const badgeClass=phase==='add'?'add':'mul';
  gids.forEach(gid=>{
    const grp=catsSnapshot.find(c=>c.gid===gid);
    if(!grp)return;
    grp.cells.forEach(([r,c])=>{
      const el=boardEl.children[r*bsc+c];
      if(!el)return;
      el.classList.remove(pulseClass);
      void el.offsetWidth;
      el.classList.add(pulseClass);
      setTimeout(()=>el.classList.remove(pulseClass),700);
    });
    // Badge on topmost-leftmost cell
    const tcell=grp.cells.reduce((best,[r,c])=>(r<best[0]||(r===best[0]&&c<best[1]))?[r,c]:best,[Infinity,Infinity]);
    const el=boardEl.children[tcell[0]*bsc+tcell[1]];
    if(!el)return;
    const rect=el.getBoundingClientRect();
    const badge=document.createElement('div');
    badge.className='cat-bonus-badge '+badgeClass;
    const label=phase==='mul'?'×':'+';
    badge.textContent=label;
    badge.style.left=(rect.right-11)+'px';
    badge.style.top=(rect.top-11)+'px';
    seq.appendChild(badge);
    setTimeout(()=>badge.classList.add('show'),20);
    setTimeout(()=>badge.classList.remove('show'),550);
    setTimeout(()=>badge.remove(),800);
  });
}

function _syncTbScore(val){const el=g('g-topbar-score');if(el)el.querySelector('span').textContent=val;}
function animateScoreSlam(scoreEl,newVal,baseScoreBeforeHand){
  if(!scoreEl)return;
  scoreEl.classList.add('score-slam-out');
  setTimeout(()=>{
    scoreEl.classList.remove('score-slam-out');
    const v=(baseScoreBeforeHand+newVal).toLocaleString();
    scoreEl.textContent=v;_syncTbScore(v);
    scoreEl.classList.add('score-slam-in');
    setTimeout(()=>scoreEl.classList.remove('score-slam-in'),420);
  },220);
}

function animateScoreFloatBadge(seq,scoreEl,text,baseScoreBeforeHand,newVal){
  if(!scoreEl)return;
  scoreEl.style.color='#38c0c0';
  const v=(baseScoreBeforeHand+newVal).toLocaleString();
  scoreEl.textContent=v;_syncTbScore(v);
  setTimeout(()=>{scoreEl.style.color='';},600);
  const rect=scoreEl.getBoundingClientRect();
  const badge=document.createElement('div');
  badge.className='score-float-badge';
  badge.textContent=text;
  badge.style.left=(rect.left+rect.width/2)+'px';
  badge.style.top=(rect.bottom-4)+'px';
  seq.appendChild(badge);
  setTimeout(()=>badge.remove(),950);
}

function addLogLine(parent,text){
  const line=document.createElement('div');
  line.className='seq-log-line';
  line.textContent=text;
  parent.appendChild(line);
  setTimeout(()=>line.classList.add('show'),20);
}

function endScoreSequence(total){
  const seq=g('ov-score-seq');
  seq.innerHTML='';
  seq.classList.remove('active');
  G.score+=total;
  // Sync score display
  const scoreEl=g('g-score');
  if(scoreEl)scoreEl.textContent=G.score.toLocaleString();
  _syncTbScore(G.score.toLocaleString());
  G.hands--;
  // bottomless_tote: a mid-scan ownership change (catnado destroying the tote
  // in the inventory) shifts getBPC() — resync the physical bag, reflowing
  // anything stranded in the doomed column, before the next hand renders or
  // places into it.
  bpReconcileWidth();
  if(G.score>=G.tgt){roundWin();return;}
  if(G.hands<=0||(G.deck.length===0&&G.hand.length===0)){
    const slGrp=G.bpGroups.find(gr=>gr.tdef&&gr.tdef.id==='soft_landing');
    if(slGrp){
      slGrp.tdef._expired=true;
      removeBpGid(slGrp.gid);
      roundWin();
      return;
    }
    roundFail();return;
  }
  dealHand();renderAll();
}

function roundWin(){
  // base earn + configurable payout per unused hand remaining (General → unused_hand_bonus, default 1)
  const perHand=CFG.unused_hand_bonus!=null?Number(CFG.unused_hand_bonus):1;
  const bonus=G.hands*perHand;
  const total=G.earn+bonus;
  G.cash+=total;
  const cc=document.querySelector('.cc');
  const rc=document.querySelector('.rc');
  if(cc)cc.classList.add('round-won');
  if(rc)rc.classList.add('round-won');
  const wi=g('win-inline');
  g('wi-sc').textContent=G.score.toLocaleString();
  g('wi-ea').textContent=`+$${total} ($${G.earn} base + $${bonus} from ${G.hands} unused hand${G.hands===1?'':'s'})`;
  wi.style.display='';
  void wi.offsetWidth;
  wi.classList.add('visible');
}
// Round-advance seam shared by the normal round-win path (goShop) and the
// Coffee Break skip path (cafeFinish in js/cafe.js). Assumes G.round has
// already been advanced to the incoming round and is <= RCFG.length: rolls
// that round's modifier, board layout, stats, deck and first hand.
function advanceRoundSetup(){
  // Pick this round's modifier (if any) BEFORE board layout / dealHand so
  // board_size_delta, blocked_mult, hand_size_delta etc. are already in
  // effect for every board/hand generation that happens this round.
  G.roundModifier=pickRoundModifier(G.round);
  const c=rcfg(G.round);
  const layout=setupBoardLayout(G.round,G.roundModifier);
  G.tgt=applyTargetMult(c.tgt,G.roundModifier);G.bsr=layout.rows;G.bsc=layout.cols;G.boardShape=layout.shape;G.blockedMask=layout.mask;G.earn=applyEarnMult(c.earn,G.roundModifier);G.hands=c.h||CFG.hand_count||3;G.disc=CFG.discard_count||3;G.score=0;G.discUsedRound=0;G.purrfectsThisRound=0;
  G.cats=[];G.treats=[];G.hand=[];mkDeck();dealHand();
  applyModifiers();
}
function goShop(){
  const cc=document.querySelector('.cc');
  const rc=document.querySelector('.rc');
  if(cc)cc.classList.remove('round-won');
  if(rc)rc.classList.remove('round-won');
  const wi=g('win-inline');
  wi.classList.remove('visible');
  wi.style.display='none';
  bpRestoreUsedTreats((G.usedTreats||[]).filter(tdef=>!tdef._expired));
  G.usedTreats=[];
  // bottomless_tote: the tote may have just left the player's possession (it
  // was in usedTreats until the line above; bpRestoreUsedTreats can refund it
  // when even a repack can't seat it) — and round end is also the natural
  // retry point for a pending grace shrink. Resync width now.
  bpReconcileWidth();
  // Coffee Break's shop closure lasts exactly one prep screen — a round
  // actually played and won always reopens the shop.
  G.shopClosed=false;
  G.round++;
  if(G.round>RCFG.length){
    if(G.branchId)markBranchComplete(G.branchId);
    gameInProgress=false;
    menuUpdateContinue();
    showBranchWin();
    return;
  }
  advanceRoundSetup();
  openRounds();
}

function showBranchWin(){
  const branches=BRANCHES;
  const branch=branches.find(b=>b.id===G.branchId);
  const nm=branch?branch.name:'Branch';
  const ovEl=g('ov-branch-win');
  g('bw-name').textContent=nm+' Complete!';
  ovEl.classList.remove('off');
}
function roundFail(){
  g('fv-sc').textContent=G.score.toLocaleString();
  g('fv-tg').textContent=G.tgt.toLocaleString();
  g('ov-fail').classList.remove('off');
}
function restart(){g('ov-fail').classList.add('off');gameInProgress=false;menuUpdateContinue();goToBranches();}
function closeBranchWin(){g('ov-branch-win').classList.add('off');goToBranches();}
