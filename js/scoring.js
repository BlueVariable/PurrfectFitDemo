'use strict';
// ══════════════════════════════════════════════════════
//  SCORING — animated sequence
// ══════════════════════════════════════════════════════
function doFit(){
  if(!G.cats.length)return;

  // Restore any requirements disabled by jumping_ball in the previous hand
  TDEFS.forEach(td=>{if(td._origReq!==undefined){td.req=td._origReq;delete td._origReq;}});

  // cats start at 10 per cell
  const catScores={};
  G.cats.forEach(grp=>{catScores[grp.gid]=grp.cells.length*10;});

  // sort treats top-to-bottom (higher on board = smaller row = applied first)
  const sorted=[...G.treats].sort((a,b)=>{
    const minA=Math.min(...a.cells.map(([r])=>r));
    const minB=Math.min(...b.cells.map(([r])=>r));
    return minA-minB;
  });

  // apply treats in sorted order — pass all treat cells (not just first)
  const treatResults=sorted.map(t=>{
    const res=t.tdef.fn(G.board,G.cats,G.treats,t.cells,catScores)||{};
    if(t.tdef.phase==='add') applyAddResult(t,res,catScores);
    else if(t.tdef.phase==='mul') applyMulResult(t,res,catScores);
    else if(t.tdef.phase==='x') applyXResult(t,res,catScores);
    return{treat:t,result:res,phase:t.tdef.phase};
  });

  // sum finalized cat scores
  const catTotal=Object.values(catScores).reduce((a,b)=>a+b,0);

  // board fill bonus
  const filledCells=G.board.flat().filter(c=>c.filled).length;
  const totalBoardCells=G.bsr*G.bsc;
  const boardFull=filledCells===totalBoardCells;
  const boardBonus=boardFull?totalBoardCells*(CFG.board_fill_bonus||5):0;

  const total=catTotal+boardBonus;
  G.lastScore=total;

  const catsSnapshot=[...G.cats];

  G.treats.forEach(bt=>{
    bt.cells.forEach(([r,c])=>{G.board[r][c]=emptyCell();});
    G.usedTreats.push(bt.tdef);
  });
  G.treats=[];

  runScoreSequence(catScores,treatResults,boardBonus,boardFull,total,catsSnapshot);
}

// Distribute add bonus: flat +amt per affected cat group
function applyAddResult(t,res,catScores){
  if(!res||!res.bonus)return;
  const ef=t.tdef.ef;
  const amt=extractNum(ef);
  const treatCells=t.cells;
  const [tRow,tCol]=treatCells[0];
  const affected=[];
  G.cats.forEach(grp=>{
    let hit=false;
    if(ef.includes('ALL')) hit=true;
    else if(ef.includes('ROW')) hit=grp.cells.some(([r])=>r===tRow);
    else if(ef.includes('COL')) hit=grp.cells.some(([,c])=>c===tCol);
    else if(ef.includes('SURR')||ef.includes('surrounding')){
      // check against ALL treat cells (full shape)
      hit=treatCells.some(([tr,tc])=>grp.cells.some(([r,c])=>Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
    }
    else hit=true;
    if(hit) affected.push(grp.gid);
  });
  // flat +amt per affected cat group (not per cell)
  affected.forEach(gid=>{if(catScores[gid]!==undefined)catScores[gid]+=amt;});
}

// Apply a mul-treat's multiplier to specific catScores
function applyMulResult(t,res,catScores){
  if(!res)return;
  // res format: {gids:[...], m:multiplier} OR legacy {bonus, desc}
  if(res.gids!==undefined){
    // new format
    const {gids,m}=res;
    if(!gids.length||m<=1)return;
    gids.forEach(gid=>{if(catScores[gid]!==undefined)catScores[gid]=Math.round(catScores[gid]*m);});
  }
}

function applyXResult(t,res,catScores){
  if(!res||res.skip)return;
  if(res.subPhase==='add') applyAddResult({tdef:res.copiedFrom,cells:res.laserCells},res.result,catScores);
  else if(res.subPhase==='mul') applyMulResult(t,res.result,catScores);
  // jumping_ball and brownies apply effects as side effects in their fn; nothing to do here
}

function runScoreSequence(catScores,treatResults,boardBonus,boardFull,total,catsSnapshot){
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

  // grpMap — cats start at 10 per cell; treats modify from base
  const grpMap={};
  catsSnapshot.forEach(grp=>{
    grpMap[grp.gid]={cells:grp.cells,score:grp.cells.length*10,els:[]};
  });

  const updateLabels=(highlightGids=[],color)=>{
    Object.entries(grpMap).forEach(([gid,info])=>{
      const sc=info.score;
      info.els.forEach((lbl,i)=>{
        if(sc>0){lbl.textContent='+'+sc;lbl.classList.add('show');}
        if(highlightGids.includes(gid)){
          lbl.style.background=color||'rgba(245,166,35,.85)';
          lbl.classList.add('boosted');
          setTimeout(()=>{lbl.classList.remove('boosted');lbl.style.background='';},700);
        }
      });
    });
  };

  // place ONE centered label per group (centered on bounding box of group cells)
  catsSnapshot.forEach(grp=>{
    const rs=grp.cells.map(([r])=>r), cs=grp.cells.map(([,c])=>c);
    const minR=Math.min(...rs), maxR=Math.max(...rs);
    const minC=Math.min(...cs), maxC=Math.max(...cs);
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
  function animateCounter(targetScore,duration){
    if(!scoreEl)return;
    if(_counterIv){clearInterval(_counterIv);_counterIv=null;}
    const start=displayedScore,diff=targetScore-start;
    if(diff<=0){scoreEl.textContent=(baseScoreBeforeHand+targetScore).toLocaleString();displayedScore=targetScore;return;}
    const steps2=Math.min(30,Math.ceil(duration/16));let step=0;
    if(scoreCard){scoreCard.classList.remove('score-card-lit');void scoreCard.offsetWidth;scoreCard.classList.add('score-card-lit');}
    _counterIv=setInterval(()=>{
      step++;displayedScore=Math.round(start+diff*(step/steps2));
      if(scoreEl)scoreEl.textContent=(baseScoreBeforeHand+displayedScore).toLocaleString();
      if(step>=steps2){clearInterval(_counterIv);_counterIv=null;displayedScore=targetScore;if(scoreEl)scoreEl.textContent=(baseScoreBeforeHand+targetScore).toLocaleString();}
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

  // Step 1: show base scores (10 per cell) — counter stays at 0
  steps.push({
    explain:`🐱 Base score: 10 pts per cell`,
    run(){
      updateLabels([]);
    }
  });

  // One step per treat (top-to-bottom, as sorted in doFit) — labels update, counter stays at 0
  treatResults.forEach(({treat,result,phase})=>{
    const hasEffect=phase==='add'?(result&&result.bonus>0):phase==='x'?(result&&!result.skip):(result&&result.gids&&result.gids.length&&result.m>1);
    if(!hasEffect)return;
    steps.push({
      explain:`${treat.tdef.em} ${treat.tdef.nm}: "${treat.tdef.ef}"`,
      run(){
        flashTreat(seq,boardEl,treat,G.bsc);
        const ef=treat.tdef.ef;
        const treatCells=treat.cells;
        const [tRow,tCol]=treatCells[0];
        if(phase==='add'){
          const aff=[];
          const amt=extractNum(ef);
          Object.entries(grpMap).forEach(([gid,info])=>{
            let hit=false;
            if(ef.includes('ALL'))hit=true;
            else if(ef.includes('ROW'))hit=info.cells.some(([r])=>r===tRow);
            else if(ef.includes('COL'))hit=info.cells.some(([,c])=>c===tCol);
            else if(ef.includes('SURR')||ef.includes('surrounding')){
              hit=treatCells.some(([tr,tc])=>info.cells.some(([r,c])=>Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
            }
            else hit=true;
            if(hit)aff.push(gid);
          });
          aff.forEach(gid=>{if(grpMap[gid])grpMap[gid].score+=amt;});
          updateLabels(aff,'rgba(100,210,90,.85)');
          addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: +${result.bonus}`);
        } else if(phase==='mul'){
          // mul — multiply from current score (which includes the 10/cell base)
          result.gids.forEach(gid=>{
            if(grpMap[gid]){const prev=grpMap[gid].score;grpMap[gid].score=Math.round(prev*result.m);}
          });
          updateLabels(result.gids,'rgba(240,120,40,.9)');
          addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: ×${result.m}`);
        } else if(phase==='x'){
          if(result.subPhase==='add'&&result.result&&result.result.bonus>0){
            const ef=result.copiedFrom.ef;
            const amt=extractNum(ef);
            const treatCells=result.laserCells;
            const[tRow,tCol]=treatCells[0];
            const aff=[];
            Object.entries(grpMap).forEach(([gid,info])=>{
              let hit=false;
              if(ef.includes('ALL'))hit=true;
              else if(ef.includes('ROW'))hit=info.cells.some(([r])=>r===tRow);
              else if(ef.includes('COL'))hit=info.cells.some(([,c])=>c===tCol);
              else if(ef.includes('SURR')||ef.includes('surrounding'))hit=treatCells.some(([tr,tc])=>info.cells.some(([r,c])=>Math.abs(r-tr)<=1&&Math.abs(c-tc)<=1));
              else hit=true;
              if(hit)aff.push(gid);
            });
            aff.forEach(gid=>{if(grpMap[gid])grpMap[gid].score+=amt;});
            updateLabels(aff,'rgba(100,210,90,.85)');
            addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: copied ${result.copiedFrom.em} ${result.copiedFrom.nm} → +${result.result.bonus}`);
          } else if(result.subPhase==='mul'&&result.result&&result.result.gids&&result.result.gids.length&&result.result.m>1){
            result.result.gids.forEach(gid=>{
              if(grpMap[gid]){const prev=grpMap[gid].score;grpMap[gid].score=Math.round(prev*result.result.m);}
            });
            updateLabels(result.result.gids,'rgba(240,120,40,.9)');
            addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: copied ${result.copiedFrom.em} ${result.copiedFrom.nm} → ×${result.result.m}`);
          } else if(result.disabledTreat){
            addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: disabled req for ${result.disabledTreat.em} ${result.disabledTreat.nm}`);
          } else if(result.addedCatEm!==undefined){
            addLogLine(logDiv,`${treat.tdef.em} ${treat.tdef.nm}: added ${result.addedCatEm} ${result.addedCatName} to deck`);
          }
        }
      }
    });
  });

  // Final step: sum cats top-to-bottom into counter, then board bonus, then banner
  const sortedCatGroups=[...catsSnapshot].sort((a,b)=>{
    const minA=Math.min(...a.cells.map(([r])=>r));
    const minB=Math.min(...b.cells.map(([r])=>r));
    return minA-minB;
  });
  const finalEndDelay=sortedCatGroups.length*500+(boardBonus>0?450:0)+750;
  steps.push({
    explain:`🏆 Final total: +${total.toLocaleString()} pts this hand.`,
    endDelay:finalEndDelay,
    run(){
      let running=0;
      let delay=0;
      sortedCatGroups.forEach(grp=>{
        const info=grpMap[grp.gid];
        if(!info)return;
        const target=running+info.score;
        const capturedTarget=target;
        const capturedInfo=info;
        running=target;
        setTimeout(()=>{
          flashTreat(seq,boardEl,{cells:grp.cells},G.bsc);
          const lbl=capturedInfo.els[0];
          if(lbl){lbl.classList.add('boosted');setTimeout(()=>lbl.classList.remove('boosted'),500);}
          animateCounter(capturedTarget,280);
          addLogLine(logDiv,`🐱 +${capturedInfo.score}`);
        },delay);
        delay+=500;
      });
      if(boardBonus>0){
        const bonusTarget=running+boardBonus;
        setTimeout(()=>{
          addLogLine(logDiv,`✨ Board Filled! +${boardBonus}`);
          animateCounter(bonusTarget,400);
        },delay);
        delay+=450;
      }
      setTimeout(()=>{
        addLogLine(logDiv,`🏆 Total: +${total.toLocaleString()}`);
        banner.textContent='+'+total.toLocaleString();
        banner.classList.add('show');
      },delay+150);
    },
    isLast:true
  });

  let stepIdx=-1;
  function runNextStep(){
    stepIdx++;
    if(stepIdx>=steps.length){endScoreSequence(total);return;}
    const step=steps[stepIdx];
    stepExplain.textContent=step.explain;
    setTimeout(()=>step.run(),80);
    if(DEV_MODE){
      nextBtn.textContent=step.isLast?'Finish ✓':'Next →';
      nextBtn.onclick=step.isLast?()=>endScoreSequence(total):runNextStep;
    }else{
      const delay=step.isLast?(step.endDelay||1800):750;
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
  if(scoreEl) scoreEl.textContent=G.score.toLocaleString();
  // No popup — go straight to next hand logic
  G.hands--;
  if(G.score>=G.tgt){roundWin();return;}
  if(G.hands<=0||(G.deck.length===0&&G.hand.length===0)){roundFail();return;}
  dealHand();renderAll();
}

function roundWin(){
  // base earn + $1 per unused hand remaining
  const bonus=G.hands; // G.hands was decremented before roundWin called, so this is hands remaining
  const total=G.earn+bonus;
  G.cash+=total;
  g('wv-sc').textContent=G.score.toLocaleString();
  g('wv-ea').textContent=`+$${total} ($${G.earn} base + $${bonus} unused hands)`;
  g('ov-win').classList.remove('off');
}
function goShop(){
  g('ov-win').classList.add('off');
  // restore treats used this round back to backpack
  (G.usedTreats||[]).forEach(tdef=>bpAutoPlace(tdef));
  G.usedTreats=[];
  // advance round
  G.round++;
  const c=rcfg(G.round);
  G.tgt=c.tgt;G.bsr=c.bsr;G.bsc=c.bsc;G.earn=c.earn;G.hands=c.h;G.disc=CFG.discard_count||3;G.score=0;
  G.firstShop=false;
  G.cats=[];G.treats=[];G.hand=[];mkDeck();dealHand();
  openRounds();
}
function roundFail(){
  g('fv-sc').textContent=G.score.toLocaleString();
  g('fv-tg').textContent=G.tgt.toLocaleString();
  g('ov-fail').classList.remove('off');
}
function restart(){g('ov-fail').classList.add('off');gameInProgress=false;updateContinueBtn();show('s-title');}
