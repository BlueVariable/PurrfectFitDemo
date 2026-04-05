'use strict';
// ══════════════════════════════════════════════════════
//  SCORING — scan-order animated sequence
//  Pieces (cats + treats) are processed top-left → bottom-right.
//  A piece's "trigger cell" is its topmost-then-leftmost cell.
//  When a cat fires: buffered treat effects are applied, score locked in.
//  When a treat fires: its result is buffered for future cats.
// ══════════════════════════════════════════════════════
function doFit(){
  if(!G.cats.length)return;

  // Restore any requirements disabled by jumping_ball in the previous hand
  TDEFS.forEach(td=>{if(td._origReq!==undefined){td.req=td._origReq;delete td._origReq;}});

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
  allPieces.sort((a,b)=>a.trigger[0]-b.trigger[0]||a.trigger[1]-b.trigger[1]);

  const catScores={};
  const scoredGids=new Set();
  const treatBuffer=[]; // {treat, result, phase} — effects waiting to apply to future cats
  const scanResults=[]; // passed to animation
  let runningTotal=0;

  for(const item of allPieces){
    if(item.kind==='cat'){
      const cat=item.piece;
      const base=cat.cells.length*10;
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

      if(result.scoreMultiplier){
        // Type B mul: apply to running total directly, do not buffer
        result.prevTotal=runningTotal;
        runningTotal=Math.round(runningTotal*result.m);
        result.newTotal=runningTotal;
      }else if(result.scoreBonus!==undefined){
        // Type B add: apply to running total directly, do not buffer
        result.prevTotal=runningTotal;
        runningTotal+=result.scoreBonus;
        result.newTotal=runningTotal;
      }else{
        // Type A: buffer for future cats; compute affectedGids for animation
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

  // Board fill bonus
  const filledCells=G.board.flat().filter(c=>c.filled).length;
  const totalBoardCells=G.bsr*G.bsc;
  const boardFull=filledCells===totalBoardCells;
  const boardBonus=boardFull?totalBoardCells*(CFG.board_fill_bonus||5):0;

  const total=runningTotal+boardBonus;
  G.lastScore=total;

  const catsSnapshot=[...G.cats];

  G.treats.forEach(bt=>{
    bt.cells.forEach(([r,c])=>{G.board[r][c]=emptyCell();});
    G.usedTreats.push(bt.tdef);
  });
  G.treats=[];

  runScoreSequence(scanResults,boardBonus,boardFull,total,catsSnapshot);
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
    if(result.luckyGid===cat.gid)return 4;
    if(result.halvedGids&&result.halvedGids.includes(cat.gid))return 0.5;
  }
  return 1;
}

// ── Scan-order animation ──
function runScoreSequence(scanResults,boardBonus,boardFull,total,catsSnapshot){
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
      const{piece:treat,result,phase,skipped}=item;
      if(skipped){
        steps.push({
          kind:'treat',
          explain:`${treat.tdef.em} ${treat.tdef.nm}: req not met`,
          run(){addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: req not met`);}
        });
        return;
      }

      // Build log line describing what this treat does
      let logLine=`${treat.tdef.em} ${treat.tdef.nm}`;
      if(phase==='add'){
        if(result.bonusMap){
          const futureBonus=Object.values(result.bonusMap).reduce((a,b)=>a+b,0);
          if(futureBonus>0)logLine+=`: +${futureBonus} buffered`;
        }else if(result.bonus>0){
          logLine+=`: +${extractNum(treat.tdef.ef)} buffered`;
        }else if(result.scoreBonus!==undefined){
          logLine+=`: +${result.scoreBonus}`;
        }
      }else if(phase==='mul'){
        if(result.gids&&result.gids.length&&result.m>1)
          logLine+=`: ×${result.m} (${result.gids.length} cat${result.gids.length!==1?'s':''} ahead)`;
      }else if(phase==='x'){
        if(result.scoreMultiplier&&result.m>1)logLine+=`: copied ${result.copiedFrom?.em||''} ×${result.m}`;
        else if(result.subPhase==='add')logLine+=`: copied ${result.copiedFrom.em} buffered`;
        else if(result.subPhase==='mul'&&result.result?.m>1)logLine+=`: copied ${result.copiedFrom.em} ×${result.result.m}`;
        else if(result.subPhase==='mirror')logLine+=`: mirror +${result.totalBonus||0}`;
        else if(result.luckyGid)logLine+=`: ×4 lucky, ×½ others`;
        else if(result.disabledTreat)logLine+=`: disabled req for ${result.disabledTreat.em} ${result.disabledTreat.nm}`;
        else if(result.addedCatEm!==undefined)logLine+=`: added ${result.addedCatEm} ${result.addedCatName} to deck`;
        else if(result.transformedInto)logLine+=`: transformed → ${result.transformedInto.em} ${result.transformedInto.nm}`;
        else if(result.convertedGid)logLine+=`: converted ${result.oldType} → ${result.convertedEm} ${result.newType}`;
        else if(result.destroyedCat)logLine+=`: removed ${result.destroyedCat.em} ${result.destroyedCat.name}`;
      }

      steps.push({
        kind:'treat',
        explain:`${treat.tdef.em} ${treat.tdef.nm}: "${treat.tdef.ef}"`,
        run(){
          flashTreat(seq,boardEl,treat,G.bsc);
          addLogLine(logDiv,logLine);

          if(result.scoreMultiplier){
            // Type B mul: score slam (any phase — x-phase treats like laser/encore/loaded_dice may propagate this)
            if(result.m!==1){
              animateScoreSlam(scoreEl,result.newTotal,baseScoreBeforeHand);
              displayedScore=result.newTotal;
            }
          }else if(result.scoreBonus!==undefined){
            // Type B add: floating badge (any phase — e.g. big_bite is x-phase)
            const sign=result.scoreBonus>=0?'+':'';
            animateScoreFloatBadge(seq,scoreEl,sign+result.scoreBonus,baseScoreBeforeHand,result.newTotal);
            displayedScore=result.newTotal;
          }else if(phase==='mul'&&result.gids&&result.gids.length){
            // Type A mul: gold pulse on matching cats
            flashCatCells(seq,boardEl,result.gids,catsSnapshot,G.bsc,'mul');
          }else if(phase==='add'&&result._affectedGids&&result._affectedGids.length){
            // Type A add: cyan pulse on affected cats
            flashCatCells(seq,boardEl,result._affectedGids,catsSnapshot,G.bsc,'add');
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
  // Restore treats used this play back to backpack immediately
  (G.usedTreats||[]).filter(tdef=>!tdef._expired).forEach(tdef=>bpAutoPlace(tdef));
  G.usedTreats=[];
  // No popup — go straight to next hand logic
  G.hands--;
  if(G.score>=G.tgt){roundWin();return;}
  if(G.hands<=0||(G.deck.length===0&&G.hand.length===0)){roundFail();return;}
  dealHand();renderAll();
}

function roundWin(){
  // base earn + $1 per unused hand remaining
  const bonus=G.hands;
  const total=G.earn+bonus;
  G.cash+=total;
  const cc=document.querySelector('.cc');
  const rc=document.querySelector('.rc');
  if(cc)cc.classList.add('round-won');
  if(rc)rc.classList.add('round-won');
  const wi=g('win-inline');
  g('wi-sc').textContent=G.score.toLocaleString();
  g('wi-ea').textContent=`+$${total} ($${G.earn} base + $${bonus} unused hands)`;
  wi.style.display='';
  void wi.offsetWidth;
  wi.classList.add('visible');
}
function goShop(){
  const cc=document.querySelector('.cc');
  const rc=document.querySelector('.rc');
  if(cc)cc.classList.remove('round-won');
  if(rc)rc.classList.remove('round-won');
  const wi=g('win-inline');
  wi.classList.remove('visible');
  wi.style.display='none';
  (G.usedTreats||[]).filter(tdef=>!tdef._expired).forEach(tdef=>bpAutoPlace(tdef));
  G.usedTreats=[];
  G.round++;
  if(G.round>RCFG.length){
    if(G.branchId)markBranchComplete(G.branchId);
    gameInProgress=false;
    menuUpdateContinue();
    showBranchWin();
    return;
  }
  const c=rcfg(G.round);
  G.tgt=c.tgt;G.bsr=c.bsr;G.bsc=c.bsc;G.earn=c.earn;G.hands=c.h||CFG.hand_count||3;G.disc=CFG.discard_count||3;G.score=0;
  G.cats=[];G.treats=[];G.hand=[];mkDeck();dealHand();
  applyModifiers();
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
