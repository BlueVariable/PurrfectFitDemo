'use strict';
// ══════════════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════════════
function openDeckPopup(){
  const deck=G.deck;
  g('deck-pop-sub').textContent=deck.length+' card'+(deck.length!==1?'s':'')+' remaining';
  const grid=g('deck-pop-grid');
  grid.innerHTML='';
  if(deck.length===0){grid.innerHTML='<div style="color:var(--mu);font-size:13px;grid-column:1/-1;text-align:center;padding:12px;">Deck is empty!</div>';g('ov-deck').classList.remove('off');return;}
  deck.forEach(cat=>{
    const d=document.createElement('div');
    d.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--cbg);border-radius:10px;padding:8px 4px;border:2px solid '+cat.col+';';
    d.innerHTML=shpHTML(cat.cells,cat.col,10)+'<div style="font-size:9px;font-weight:800;color:var(--mu);text-align:center;line-height:1.2;">'+cat.em+' '+cap(cat.type)+'<br><span style=\'color:var(--tx);\'>'+cat.shape+'</span></div>';
    grid.appendChild(d);
  });
  g('ov-deck').classList.remove('off');
}
function closeDeckPopup(){g('ov-deck').classList.add('off');}

function show(id){document.querySelectorAll('.scr').forEach(s=>s.classList.remove('on'));g(id).classList.add('on');}
function openDeckPreview(deckId){
  // Build a preview deck and show popup
  const cfg=DECKS[deckId];
  const validShapes=Object.entries(CSHAPES).filter(([k,v])=>v.reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0)>1).map(([k])=>k);
  const previewCards=[];
  for(let i=0;i<(CFG.deck_card_count||30);i++){
    const type=cfg.ty[i%cfg.ty.length];
    let shape=cfg.sh[i%cfg.sh.length];
    if(!validShapes.includes(shape))shape=validShapes[i%validShapes.length];
    previewCards.push({type,shape,cells:CSHAPES[shape],col:COLS[type],em:EMS[type]});
  }
  const grid=g('deck-pop-grid');
  if(!grid)return;
  grid.innerHTML='';
  previewCards.forEach(cat=>{
    const d=document.createElement('div');
    d.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--cbg);border-radius:10px;padding:8px 4px;border:2px solid '+cat.col+';';
    d.innerHTML=shpHTML(cat.cells,cat.col,10)+'<div style="font-size:9px;font-weight:800;color:var(--mu);text-align:center;line-height:1.2;">'+cat.em+' '+cap(cat.type)+'<br><span style=\'color:var(--tx);\'>'+cat.shape+'</span></div>';
    grid.appendChild(d);
  });
  const deckName=(DECK_META[deckId]&&DECK_META[deckId].name)||deckId;
  g('deck-pop-sub').textContent=deckName+' — '+(CFG.deck_card_count||30)+' cards';
  g('ov-deck').classList.remove('off');
}
// Boot: fetch sheets then init
document.addEventListener('DOMContentLoaded',loadConfig);

function menuUpdateContinue(){
  const btn=g('btn-menu-continue');
  if(btn)btn.style.display=gameInProgress?'block':'none';
}
function menuContinue(){
  if(!gameInProgress)return;
  openRounds();
}
function menuPlay(){goToBranches();}
function exitToMenu(){
  H=resetH();
  updateGhost();hideHUD();
  show('s-menu');
  menuUpdateContinue();
}
function openRounds(){
  shopBoughtIds=new Set();
  g('shop-sub').textContent=G.visitedShop?'"back for more treats!"':'"stock up before the round!"';
  G.visitedShop=true;
  shopPool=generateShopPool();
  renderShopFull();
  renderRoundsTrack();
  g('rds-play-num').textContent=G.round;
  show('s-rounds');
}
function startRound(){
  if(H.kind==='shop-treat'){
    H=resetH();
    updateGhost();hideHUD();
  }
  show('s-game');renderAll();
}
function renderRoundsTrack(){
  // Pip track
  const pips=g('rds-pips');
  if(pips){
    pips.innerHTML='';
    for(let i=1;i<=RCFG.length;i++){
      const p=document.createElement('div');
      p.className='rds-pip'+(i<G.round?' done':i===G.round?' cur':'');
      p.title='Round '+i;
      pips.appendChild(p);
    }
  }
  // Update round card stats
  const cfg=rcfg(G.round);
  const rn=g('rds-play-num');if(rn)rn.textContent=G.round;
  const rt=g('rds-tgt');if(rt)rt.textContent=cfg.tgt.toLocaleString();
  const re=g('rds-earn');if(re)re.textContent='+$'+cfg.earn;
  const rb=g('rds-board');if(rb)rb.textContent=cfg.bsr+'×'+cfg.bsc;
}
function renderAll(){renderStats();renderBoard();renderHand();renderBP();updFit();}

function checkBoardFull(){
  const filled=G.board.flat().filter(c=>c.filled).length;
  if(filled<G.bsr*G.bsc)return;
  // Ripple glow across board cells
  const boardEl=g('board');
  const cells=boardEl.querySelectorAll('.cell');
  cells.forEach((cell,idx)=>{
    const r=Math.floor(idx/G.bsc),c=idx%G.bsc;
    const dist=Math.sqrt(Math.pow(r-G.bsr/2,2)+Math.pow(c-G.bsc/2,2));
    setTimeout(()=>cell.classList.add('board-full-glow'),dist*60);
  });
  // Sparkles burst from board center
  const boardRect=boardEl.getBoundingClientRect();
  const cx=boardRect.left+boardRect.width/2,cy=boardRect.top+boardRect.height/2;
  for(let i=0;i<18;i++){
    const spark=document.createElement('div');
    spark.className='purrfect-sparkle';
    const angle=Math.random()*Math.PI*2;
    const radius=40+Math.random()*80;
    spark.style.left=(cx+Math.cos(angle)*radius)+'px';
    spark.style.top=(cy+Math.sin(angle)*radius)+'px';
    spark.style.animationDelay=(Math.random()*0.4)+'s';
    spark.style.width=(4+Math.random()*8)+'px';
    spark.style.height=spark.style.width;
    document.body.appendChild(spark);
    setTimeout(()=>spark.remove(),1400);
  }
  // Floating text
  const ov=document.createElement('div');
  ov.className='purrfect-fit-overlay';
  ov.innerHTML='<div class="purrfect-fit-text">PURRFECT FIT!</div>';
  document.body.appendChild(ov);
  setTimeout(()=>ov.remove(),2500);
}

function renderStats(){
  g('g-tgt').textContent=G.tgt.toLocaleString();
  g('g-earn').textContent=G.earn;
  g('g-score').textContent=G.score.toLocaleString();
  g('g-hands').textContent=G.hands;
  g('g-last').textContent=G.lastScore;
  g('g-deck').textContent=G.deck.length;
  if(g('g-round-top'))g('g-round-top').textContent=G.round;
  g('g-bsize').textContent=`${G.bsr}×${G.bsc} board`;
  const trashBadge=g('trash-badge');
  if(trashBadge) trashBadge.textContent=G.disc;
  const trashEl=g('trash-drop');
  if(trashEl){
    trashEl.classList.toggle('no-disc',G.disc<=0);
    trashEl.classList.toggle('drag-active',H.kind==='cat'&&G.disc>0&&!!trashEl._hover);
  }
  if (g('g-topbar-round')) g('g-topbar-round').textContent = 'Round ' + G.round;
  if (g('g-topbar-cash'))  g('g-topbar-cash').querySelector('span:last-child').textContent = G.cash;
}

function treatReqFails(td){
  return requirementFails(td.req);
}

function showBoardTip(e,r,c){
  if(H.kind)return; // don't show tip while dragging
  const bd=G.board[r][c];if(!bd.filled)return;
  const tip=g('board-tip');
  if(bd.kind==='cat'){
    // find cat group score (cells * 10 base)
    const grp=G.cats.find(g=>g.cells.some(([gr,gc])=>gr===r&&gc===c));
    if(!grp)return;
    const base=grp.cells.length*(CFG.base_score_per_cell||10);
    tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:var(--or)">${cap(grp.type)} Cat</div><div style="font-size:10px;margin-top:2px;">${grp.shape} shape · ${grp.cells.length} cells</div><div style="color:#72cc60;margin-top:2px;">Base: +${base} pts</div>`;
  } else if(bd.kind==='treat'){
    const gid=bd.gid;
    const ti=G.treats.find(t=>t.gid===gid);
    if(!ti)return;
    const td=ti.tdef;
    tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:10px;margin-top:3px;color:#c8d0e8;">${td.ef}</div>${td.req?`<div style="font-size:9px;color:var(--or);margin-top:2px;">${td.req}</div>`:''}`;
  }
  tip.style.display='block';
  moveBoardTip(e);
}
function moveTip(e){
  const tip=g('board-tip');
  if(tip.style.display==='none')return;
  tip.style.left=Math.min(e.clientX+14,window.innerWidth-190)+'px';
  tip.style.top=Math.max(e.clientY-8,4)+'px';
}
function moveBoardTip(e){moveTip(e);}
function hideBoardTip(){g('board-tip').style.display='none';}
function showBPTip(e,r,c){
  if(H.kind)return;
  const bd=G.bp[r][c];if(!bd.filled||!bd.tdef)return;
  const td=bd.tdef;
  const fail=treatReqFails(td);
  const tip=g('board-tip');
  tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:13px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:10px;margin-top:3px;color:#c8d0e8;">${td.ef}</div>${td.req?`<div style="font-size:9px;color:var(--or);margin-top:2px;">${td.req}</div>`:''}${fail?'<div style="font-size:9px;color:#f04040;margin-top:3px;">⚠ Requirement not met</div>':''}`;
  tip.style.display='block';
  moveBPTip(e);
}
function moveBPTip(e){moveTip(e);}
function hideBPTip(){g('board-tip').style.display='none';}

function renderBoard(){
  const el=g('board');
  const maxH=window.innerHeight-168,maxW=(document.querySelector('.cc')?.offsetWidth||440)-38;
  const cs=Math.min(Math.floor((maxH-14)/G.bsr)-3,Math.floor((maxW-14)/G.bsc)-3,78);
  window._boardCellSize=cs;
  el.style.gridTemplateColumns=`repeat(${G.bsc},${cs}px)`;
  el.innerHTML='';
  for(let r=0;r<G.bsr;r++) for(let c=0;c<G.bsc;c++){
    const div=document.createElement('div');
    div.className='cell';
    div.style.width=cs+'px';div.style.height=cs+'px';
    div.style.fontSize=Math.floor(cs*.36)+'px';
    const bd=G.board[r][c];
    if(bd.filled){
      div.classList.add('filled');
      div.style.background=bd.col;
      div.style.borderColor='rgba(255,255,255,.18)';
      div.title=bd.kind==='cat'?'Click to pick up':'Click to return to backpack';
      if(bd.kind==='cat'){
        div.textContent='';
      } else {
        div.style.fontSize=Math.floor(cs*.45)+'px';
        div.textContent=bd.em||'';
        // outline treat if its requirement fails
        const gid=bd.gid;
        const bt=G.treats.find(t=>t.gid===gid);
        if(bt&&treatReqFails(bt.tdef)){
          div.style.borderColor='#e04848';
          div.style.position='relative';
          const badge=document.createElement('span');
          badge.style.cssText='position:absolute;top:2px;right:2px;background:#e04848;color:#fff;border-radius:50%;width:13px;height:13px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,.5);pointer-events:none;line-height:1;';
          badge.textContent='!';
          div.appendChild(badge);
        }
        // mousedown on treat: start drag immediately
        div.addEventListener('mousedown',(e)=>{if(e.button!==0||H.kind)return;e.stopPropagation();onBoardClick(r,c);});
      }
    }
    div.addEventListener('mouseenter',(e)=>{H._lastBoardR=r;H._lastBoardC=c;delete H._lastBpR;onBoardEnter(r,c);showBoardTip(e,r,c);});
    div.addEventListener('mousemove',(e)=>moveBoardTip(e));
    div.addEventListener('mouseleave',()=>{onBoardLeave();hideBoardTip();});
    div.addEventListener('click',()=>onBoardClick(r,c));
    // Touch: pick up filled cells to start a drag; empty cells handled by global touchend
    div.addEventListener('touchstart',(e)=>{
      if(H.kind)return; // already holding — drop handled by global touchend
      const bd=G.board[r][c];
      if(!bd.filled)return;
      e.preventDefault();
      _touchMovedWhileHeld=false;
      onBoardClick(r,c); // picks up cat or treat
    },{passive:false});
    el.appendChild(div);
  }
}

function renderHand(){
  const row=g('hand');row.innerHTML='';
  G.hand.forEach((cat,i)=>{
    const isHeld=H.kind==='cat'&&H.handIdx===i;
    const d=document.createElement('div');
    d.className='cslot'+(isHeld?' held':'');
    d.innerHTML=shpHTML(cat.cells,cat.col,9)+`<div class="csn">${cat.em} ${cap(cat.type)}</div>`;
    d.addEventListener('mousedown',(e)=>{
      if(e.button!==0)return;
      // compute grab offset within the mini shape preview
      const cells=rotC(cat.cells,H.kind==='cat'&&H.handIdx===i?H.rot:0);
      const sz=9,gap=1;
      const gridW=cells[0].length*(sz+gap);
      const gridH=cells.length*(sz+gap);
      const rect=d.getBoundingClientRect();
      const slotCX=rect.left+rect.width/2, slotCY=rect.top+rect.height/2-8;
      const relX=e.clientX-(slotCX-gridW/2);
      const relY=e.clientY-(slotCY-gridH/2);
      const grabDc=Math.max(0,Math.min(cells[0].length-1,Math.floor(relX/(sz+gap))));
      const grabDr=Math.max(0,Math.min(cells.length-1,Math.floor(relY/(sz+gap))));
      pickupCatWithGrab(i,grabDr,grabDc);
    });
    d.addEventListener('touchstart',(e)=>{
      e.preventDefault();
      _touchMovedWhileHeld=false;
      const t=e.touches[0];
      const cells=rotC(cat.cells,H.kind==='cat'&&H.handIdx===i?H.rot:0);
      const sz=9,gap=1;
      const gridW=cells[0].length*(sz+gap);
      const gridH=cells.length*(sz+gap);
      const rect=d.getBoundingClientRect();
      const slotCX=rect.left+rect.width/2, slotCY=rect.top+rect.height/2-8;
      const relX=t.clientX-(slotCX-gridW/2);
      const relY=t.clientY-(slotCY-gridH/2);
      const grabDc=Math.max(0,Math.min(cells[0].length-1,Math.floor(relX/(sz+gap))));
      const grabDr=Math.max(0,Math.min(cells.length-1,Math.floor(relY/(sz+gap))));
      pickupCatWithGrab(i,grabDr,grabDc);
    },{passive:false});
    d.addEventListener('click',()=>{if(!H.dragging)pickupCat(i);});
    row.appendChild(d);
  });
  for(let i=G.hand.length;i<(CFG.hand_dealt_count||7);i++){const e=document.createElement('div');e.className='eslot';row.appendChild(e);}
}

function renderBP(){
  const grid=g('bpg');
  const cs=window._boardCellSize||46;
  grid.style.gridTemplateColumns=`repeat(${getBPC()},${cs}px)`;
  grid.innerHTML='';
  for(let r=0;r<getBPR();r++) for(let c=0;c<getBPC();c++){
    const div=document.createElement('div');
    div.className='bpc';
    div.style.width=cs+'px';div.style.height=cs+'px';
    const bd=G.bp[r][c];
    if(bd.filled){
      div.classList.add('ft');
      div.style.background=bd.col+'bb';
      div.style.borderColor=bd.col;
      div.style.position='relative';
      div.textContent=bd.em||'';
      if(bd.gid===G.selBpGid) div.classList.add('sel-t');
      // Use drag-threshold: only pick up if mouse moves > 5px after mousedown
      div.addEventListener('mousedown',(e)=>{
        if(e.button!==0)return;
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.stopPropagation();
        const startX=e.clientX,startY=e.clientY;
        let dragging=false;
        const onMove=(me)=>{
          if(dragging)return;
          if(Math.abs(me.clientX-startX)>5||Math.abs(me.clientY-startY)>5){
            dragging=true;
            document.removeEventListener('mousemove',onMove);
            document.removeEventListener('mouseup',onUp);
            dropHeld();
            removeBpGid(gid);
            G.selBpGid=null;hideTTP();
            H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
               color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
               grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
            updateGhost();showHUD();renderBP();
          }
        };
        const onUp=()=>{
          document.removeEventListener('mousemove',onMove);
          document.removeEventListener('mouseup',onUp);
          // Was a click (no drag): select/deselect
          if(!dragging){
            if(G.selBpGid===gid){G.selBpGid=null;hideTTP();}
            else{G.selBpGid=gid;showTTP(grp.tdef);}
            renderBP();
          }
        };
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp);
      });
      // Touch: drag-threshold same as mouse (> 5px = drag, else tap = select/deselect)
      div.addEventListener('touchstart',(e)=>{
        const gid=bd.gid;
        const grp=G.bpGroups.find(g=>g.gid===gid);
        if(!grp)return;
        e.stopPropagation();
        e.preventDefault();
        const t=e.touches[0];
        const startX=t.clientX,startY=t.clientY;
        let tdragging=false;
        const onTMove=(me)=>{
          me.preventDefault();
          if(tdragging)return;
          const mt=me.touches[0];
          if(Math.abs(mt.clientX-startX)>5||Math.abs(mt.clientY-startY)>5){
            tdragging=true;
            _touchMovedWhileHeld=true;
            document.removeEventListener('touchmove',onTMove);
            document.removeEventListener('touchend',onTEnd);
            dropHeld();
            removeBpGid(gid);
            G.selBpGid=null;hideTTP();
            H={kind:'treat',source:'bp',data:grp.tdef,cells:grp.tdef.bpS,rot:0,
               color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
               grabDr:Math.floor(grp.tdef.bpS.length/2),grabDc:Math.floor(grp.tdef.bpS[0].length/2),dragging:true};
            updateGhost();showHUD();renderBP();
          }
        };
        const onTEnd=()=>{
          document.removeEventListener('touchmove',onTMove);
          document.removeEventListener('touchend',onTEnd);
          if(!tdragging){
            if(G.selBpGid===gid){G.selBpGid=null;hideTTP();}
            else{G.selBpGid=gid;showTTP(grp.tdef);}
            renderBP();
          }
        };
        document.addEventListener('touchmove',onTMove,{passive:false});
        document.addEventListener('touchend',onTEnd);
      },{passive:false});
    }
    div.addEventListener('mouseenter',(e)=>{H._lastBpR=r;H._lastBpC=c;delete H._lastBoardR;onBPEnter(r,c);showBPTip(e,r,c);});
    div.addEventListener('mousemove',(e)=>moveBPTip(e));
    div.addEventListener('mouseleave',()=>{onBPLeave();hideBPTip();});
    div.addEventListener('mouseup',()=>onBPMouseUp(r,c));
    grid.appendChild(div);
  }
}

function shpHTML(cells,col,sz){
  const cols=cells[0].length;
  let h=`<div style="display:grid;grid-template-columns:repeat(${cols},${sz}px);gap:1px">`;
  cells.forEach(row=>row.forEach(v=>{
    if(v) h+=`<div style="width:${sz}px;height:${sz}px;border-radius:2px;background:${col};"></div>`;
    else  h+=`<div style="width:${sz}px;height:${sz}px;"></div>`;
  }));
  return h+'</div>';
}

function showTTP(t){
  g('ttn').textContent=t.nm;
  g('tte').innerHTML=t.ef.replace(/×(\d+)/g,'<span>×$1</span>').replace(/\+(\d+)/g,'<span>+$1</span>');
  const ttr=g('ttr');if(t.req){ttr.textContent=t.req;ttr.style.display='block';}else ttr.style.display='none';
  g('ttf').textContent=t.fl||'';
  g('ttp').classList.add('on');
}
function hideTTP(){g('ttp').classList.remove('on');}
function updFit(){g('btn-fit').disabled=G.cats.length===0;}
