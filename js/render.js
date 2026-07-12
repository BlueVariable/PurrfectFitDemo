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
  const sorted=[...deck].sort((a,b)=>a.type<b.type?-1:a.type>b.type?1:0);
  sorted.forEach(cat=>{
    const d=document.createElement('div');
    d.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--cbg);border-radius:10px;padding:8px 4px;border:2px solid '+cat.col+';';
    d.innerHTML=((typeof catArtHTML==='function'&&catArtHTML(cat.shape,cat.type,46))||shpHTML(cat.cells,cat.col,10))+'<div style="font-size:9px;font-weight:800;color:var(--mu);text-align:center;line-height:1.2;">'+cat.em+' '+cap(cat.type)+'<br><span style=\'color:var(--tx);\'>'+cat.shape+'</span></div>';
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
    d.innerHTML=((typeof catArtHTML==='function'&&catArtHTML(cat.shape,cat.type,46))||shpHTML(cat.cells,cat.col,10))+'<div style="font-size:9px;font-weight:800;color:var(--mu);text-align:center;line-height:1.2;">'+cat.em+' '+cap(cat.type)+'<br><span style=\'color:var(--tx);\'>'+cat.shape+'</span></div>';
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
  openCalendar();
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
  rerollExtraCost=0;
  g('shop-sub').textContent=G.shopClosed?'"the shopkeeper took a coffee break too!"':G.visitedShop?'"back for more treats!"':'"stock up before the round!"';
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
  // Update round card stats. Target/earn read off G (not the raw rcfg row)
  // because target_mult/earn_mult modifiers (e.g. picky_judge) already
  // baked their multiplier into G.tgt/G.earn at round setup (goShop) — the
  // prep screen must show the modified number, not the sheet's raw value.
  const cfg=rcfg(G.round);
  const rn=g('rds-play-num');if(rn)rn.textContent=G.round;
  const rt=g('rds-tgt');if(rt)rt.textContent=G.tgt.toLocaleString();
  const re=g('rds-earn');if(re)re.textContent='+$'+G.earn;
  const rb=g('rds-board');if(rb)rb.textContent=(cfg.boardSize||(G.bsr*G.bsc))+' cells';
  const rp=g('rds-purrfect');
  if(rp&&typeof purrfectPerCell==='function')rp.textContent=`✨ PURRFECT BONUS +${purrfectPerCell(G.round)}/cell`;
  renderRoundModifierCard();
  // Coffee Break button visibility + confirm-state reset (js/cafe.js).
  // typeof-guarded: render.js loads before cafe.js in index.html.
  if(typeof updateCoffeeBreakButton==='function')updateCoffeeBreakButton();
}

// Prep-screen "boss round" card — shown only when the upcoming round has a modifier.
function renderRoundModifierCard(){
  const card=g('rds-mod-card');
  if(!card)return;
  const rm=G.roundModifier;
  if(!rm){card.style.display='none';return;}
  card.style.display='';
  const em=g('rds-mod-em');if(em)em.textContent=rm.em;
  const nm=g('rds-mod-name');if(nm)nm.textContent=rm.name;
  const ds=g('rds-mod-desc');if(ds)ds.textContent=rm.desc;
}

// In-game topbar chip — mirrors the prep-screen card while G.roundModifier is active.
function renderTopbarModifier(){
  const pill=g('g-topbar-mod');
  if(!pill)return;
  const rm=G.roundModifier;
  if(!rm){pill.style.display='none';return;}
  pill.style.display='';
  pill.title=rm.desc;
  const em=g('g-topbar-mod-em');if(em)em.textContent=rm.em;
  const nm=g('g-topbar-mod-name');if(nm)nm.textContent=rm.name;
}
function renderAll(){renderStats();renderBoard();renderHand();renderBP();updFit();updateProjectedScoreUI();}

// ── Feature 2a: live projected score readout near the FIT button ──
// Recomputed wherever renderAll() already runs (every placement/removal/
// pickup-from-board already calls it) — no extra hooks needed.
function updateProjectedScoreUI(){
  const el=g('fit-proj');
  if(!el)return;
  if(typeof G==='undefined'||!G.board||!G.board.length){el.textContent='';return;}
  let proj;
  try{ proj=projectScore(null); }catch(e){ return; } // never let a preview crash the game
  const val=proj.total;
  el.textContent='~ '+val.toLocaleString();
  const stillNeeded=(G.tgt||0)-(G.score||0);
  const clears=val>=stillNeeded;
  el.classList.toggle('fit-proj-ready',clears);
  const pcNote=(typeof purrfectPerCell==='function')?` · purrfect fill adds +${purrfectPerCell(G.round)}/cell`:'';
  el.title=(clears
    ?`Projected +${val.toLocaleString()} — clears the round!`
    :`Projected +${val.toLocaleString()} — need ${Math.max(0,stillNeeded-val).toLocaleString()} more`)+pcNote;
}

// ── Feature 2b: treat spot-rating (paw tooltip + affected-cell pulse) ──
// Called from board.js's onBoardEnter while H.kind==='treat' hovers a legal
// board position. `hoverR/hoverC` are the raw hovered cell (used only to
// anchor the tooltip visually); `or/oc` are the shape's top-left anchor,
// matching sweepTreatPositions()'s {rot,r,c} coordinates.
function showTreatSpotPreview(tdef,rot,or,oc,hoverR,hoverC){
  let entry;
  try{ entry=findSweepEntry(tdef,rot,or,oc); }catch(e){ entry=null; }
  if(!entry){hidePawTip();return;}
  entry.affectedGids.forEach(gid=>{
    const grp=G.cats.find(c=>c.gid===gid);
    if(!grp)return;
    grp.cells.forEach(([rr,cc])=>{
      const el=getBCell(rr,cc);
      if(el)el.classList.add('treat-affect-preview');
    });
  });
  const anchorEl=getBCell(hoverR,hoverC);
  if(anchorEl) showPawTip(anchorEl.getBoundingClientRect(),entry.paws,entry.delta);
}
function showPawTip(rect,paws,delta){
  const tip=g('paw-tip');
  if(!tip||!rect)return;
  const sign=delta>0?'+':'';
  if(paws<=0){
    tip.innerHTML=`<div class="paw-tip-paws zero">won't score here</div><div class="paw-tip-delta">${sign}${delta} pts</div>`;
  }else{
    tip.innerHTML=`<div class="paw-tip-paws">${'🐾'.repeat(paws)}</div><div class="paw-tip-delta">${sign}${delta} pts here</div>`;
  }
  tip.style.left=(rect.left+rect.width/2)+'px';
  tip.style.top=(rect.top-10)+'px';
  tip.style.display='block';
}
function hidePawTip(){const tip=g('paw-tip');if(tip)tip.style.display='none';}
function clrTreatPreviewExtras(){
  document.querySelectorAll('.cell.treat-affect-preview').forEach(c=>c.classList.remove('treat-affect-preview'));
  hidePawTip();
}

function checkBoardFull(){
  const filled=G.board.flat().filter(c=>c.filled).length;
  const playable=G.board.flat().filter(c=>!c.blocked&&!c.offShape).length;
  if(filled<playable||playable===0)return;
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
  const tbs=g('g-topbar-score');if(tbs)tbs.querySelector('span').textContent=G.score.toLocaleString();
  g('g-hands').textContent=G.hands;
  g('g-last').textContent=G.lastScore;
  g('g-deck').textContent=G.deck.length;
  if(g('g-round-top'))g('g-round-top').textContent=G.round;
  g('g-bsize').textContent=`${G.bsr}×${G.bsc} board`;
  const pfEl=g('g-purrfect-rate');
  if(pfEl&&typeof purrfectPerCell==='function')pfEl.textContent=`✨ +${purrfectPerCell(G.round)}/cell purrfect`;
  const trashBadge=g('trash-badge');
  if(trashBadge) trashBadge.textContent=G.disc;
  const trashEl=g('trash-drop');
  if(trashEl){
    trashEl.classList.toggle('no-disc',G.disc<=0);
    trashEl.classList.toggle('drag-active',H.kind==='cat'&&G.disc>0&&!!trashEl._hover);
  }
  if (g('g-topbar-round')) g('g-topbar-round').textContent = 'Round ' + G.round;
  if (g('g-topbar-cash'))  g('g-topbar-cash').querySelector('span:last-child').textContent = G.cash;
  renderTopbarModifier();
}

function treatReqFails(td){
  return requirementFails(td.req);
}

function treatCurrentEf(td){
  // Per-treat hook wins — treats that compute a live value (e.g. big_bite,
  // crowd_pleaser, purrfect_record) provide their own currentValue() method.
  const reg=TREAT_REGISTRY[td.id];
  if(reg&&typeof reg.currentValue==='function'){
    try{const v=reg.currentValue();if(v)return v;}catch(e){}
  }
  if(!td.addEf)return null;
  const incM=td.addEf.match(/([\d.]+)/);
  if(!incM)return null;
  const plays=(G.treatPlayCounts&&G.treatPlayCounts[td.id])||0;
  if(plays===0)return null;
  const inc=parseFloat(incM[1]);
  const isMul=/[×x]/.test(td.ef);
  const baseM=td.ef.match(/([\d.]+)/);
  if(!baseM)return null;
  const base=parseFloat(baseM[1]);
  const isDecreasing=reg?.isDecreasing;
  const cur=isDecreasing
    ?Math.max(0,Math.round((base-plays*inc)*100)/100)
    :Math.round((base+plays*inc)*100)/100;
  return isMul?`Now: ×${cur}`:`Now: +${cur}`;
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
    tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:17px;color:var(--or)">${cap(grp.type)} Cat</div><div style="font-size:13px;margin-top:3px;">${grp.shape} shape · ${grp.cells.length} cells</div><div style="font-size:13px;color:#72cc60;margin-top:3px;">Base: +${base} pts</div>`;
  } else if(bd.kind==='treat'){
    const gid=bd.gid;
    const ti=G.treats.find(t=>t.gid===gid);
    if(!ti)return;
    const td=ti.tdef;
    const curEf=treatCurrentEf(td);
    tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:17px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:13px;margin-top:4px;color:#c8d0e8;">${td.ef}</div>${td.addEf?`<div style="font-size:11px;color:#9a7ed7;margin-top:3px;">${td.addEf}${curEf?` <span style="color:#e040a0">${curEf}</span>`:''}</div>`:''}${td.req?`<div style="font-size:11px;color:var(--or);margin-top:3px;">${td.req}</div>`:''}`;
  }
  tip.style.display='block';
  moveBoardTip(e);
}
function moveTip(e){
  const tip=g('board-tip');
  if(tip.style.display==='none')return;
  tip.style.left=Math.min(e.clientX+14,window.innerWidth-240)+'px';
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
  const bpCurEf=treatCurrentEf(td);
  tip.innerHTML=`<div style="font-family:'Fredoka One',cursive;font-size:17px;color:#f060a8">${td.em} ${td.nm}</div><div style="font-size:13px;margin-top:4px;color:#c8d0e8;">${td.ef}</div>${td.addEf?`<div style="font-size:11px;color:#9a7ed7;margin-top:3px;">${td.addEf}${bpCurEf?` <span style="color:#e040a0">${bpCurEf}</span>`:''}</div>`:''}${td.req?`<div style="font-size:11px;color:var(--or);margin-top:3px;">${td.req}</div>`:''}${fail?'<div style="font-size:11px;color:#f04040;margin-top:4px;">⚠ Requirement not met</div>':''}`;
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
    if(bd.offShape){
      div.classList.add('off-shape');
      div.style.background='transparent';
      div.style.border='none';
      div.style.boxShadow='none';
      div.style.pointerEvents='none';
      el.appendChild(div);
      continue;
    }
    if(bd.blocked){
      div.classList.add('blocked');
      div.style.background='repeating-linear-gradient(45deg,#1a1a24,#1a1a24 6px,#2a2a38 6px,#2a2a38 12px)';
      div.style.borderColor='rgba(0,0,0,.6)';
      div.style.boxShadow='inset 0 0 8px rgba(0,0,0,.6)';
      div.style.cursor='not-allowed';
      div.title='Blocked';
      el.appendChild(div);
      continue;
    }
    if(bd.filled){
      div.classList.add('filled');
      // Arted cat cells keep only a faint tint so the illustration overlay
      // (renderCatArtLayer) reads cleanly; treats and art-less cats fill solid.
      const catHasArt=bd.kind==='cat'&&typeof hasCatArt==='function'&&hasCatArt(bd.shape,bd.type);
      div.style.background=catHasArt?bd.col+'26':bd.col;
      div.style.borderColor=catHasArt?'rgba(255,255,255,.10)':'rgba(255,255,255,.18)';
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
  if(typeof renderCatArtLayer==='function')renderCatArtLayer();
}

function renderHand(){
  const row=g('hand');row.innerHTML='';
  G.hand.forEach((cat,i)=>{
    const isHeld=H.kind==='cat'&&H.handIdx===i;
    const d=document.createElement('div');
    d.className='cslot'+(isHeld?' held':'');
    const handArt=(typeof catArtHTML==='function')&&catArtHTML(cat.shape,cat.type,110);
    d.innerHTML=(handArt||shpHTML(cat.cells,cat.col,25))+`<div class="csn">${cat.em} ${cap(cat.type)}</div>`;
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
  const cols=getBPC(),rows=getBPR();
  // Cell size must fit the backpack panel's OWN container width, not just
  // mirror the board's cell size — the board is sized for G.bsc columns,
  // which can differ from getBPC() (inventory_cols, from the General sheet
  // tab). Reusing the board's size unmodified overflows the fixed-width
  // .rc/.bpcard panel whenever cols*cellSize > the panel's inner width
  // (e.g. inventory_cols=5 no longer fits the 4-column size the CSS was
  // tuned for), pushing/clipping the panel instead of shrinking to fit.
  const wrap=document.querySelector('.bpgw');
  const wrapInnerW=wrap?wrap.clientWidth-10:299; // .bpgw padding:5px each side
  const bpgPad=4,bpgGap=3; // must mirror .bpg's CSS padding/gap
  const fitW=Math.floor((wrapInnerW-bpgPad*2-bpgGap*(cols-1))/cols);
  const boardCs=window._boardCellSize||46;
  const cs=Math.max(18,Math.min(fitW,boardCs,78));
  grid.style.gridTemplateColumns=`repeat(${cols},${cs}px)`;
  grid.innerHTML='';
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
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
            const pose=bpPoseOf(grp);
            removeBpGid(gid);
            G.selBpGid=null;hideTTP();
            const gDr=Math.max(0,Math.min(pose.shape.length-1,r-(grp.or??r)));
            const gDc=Math.max(0,Math.min(pose.shape[0].length-1,c-(grp.oc??c)));
            H={kind:'treat',source:'bp',data:grp.tdef,cells:pose.shape,rot:pose.rot,
               color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
               grabDr:gDr,grabDc:gDc,dragging:true,bpOrigin:pose};
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
            const pose=bpPoseOf(grp);
            removeBpGid(gid);
            G.selBpGid=null;hideTTP();
            const gDr=Math.max(0,Math.min(pose.shape.length-1,r-(grp.or??r)));
            const gDc=Math.max(0,Math.min(pose.shape[0].length-1,c-(grp.oc??c)));
            H={kind:'treat',source:'bp',data:grp.tdef,cells:pose.shape,rot:pose.rot,
               color:grp.tdef.col,em:grp.tdef.em,handIdx:null,boardGid:null,bpGid:gid,
               grabDr:gDr,grabDc:gDc,dragging:true,bpOrigin:pose};
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
  let h=`<div style="display:grid;grid-template-columns:repeat(${cols},${sz}px);gap:5px">`;
  cells.forEach(row=>row.forEach(v=>{
    if(v) h+=`<div style="width:${sz}px;height:${sz}px;border-radius:2px;background:${col};"></div>`;
    else  h+=`<div style="width:${sz}px;height:${sz}px;"></div>`;
  }));
  return h+'</div>';
}

function showTTP(t){
  g('ttn').textContent=t.nm;
  g('tte').innerHTML=t.ef.replace(/×(\d+)/g,'<span>×$1</span>').replace(/\+(\d+)/g,'<span>+$1</span>');
  const ttae=g('ttae');
  if(t.addEf){
    const cur=treatCurrentEf(t);
    ttae.innerHTML=t.addEf+(cur?` <span>${cur}</span>`:'');
    ttae.style.display='block';
  } else {
    ttae.style.display='none';
  }
  const ttr=g('ttr');if(t.req){ttr.textContent=t.req;ttr.style.display='block';}else ttr.style.display='none';
  g('ttf').textContent=t.fl||'';
  g('ttp').classList.add('on');
}
function hideTTP(){g('ttp').classList.remove('on');}
function updFit(){g('btn-fit').disabled=G.cats.length===0&&!G.board.some(r=>r.some(c=>c.filled));}
