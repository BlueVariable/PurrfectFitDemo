# Treat Animation Type Distinction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distinguish four treat animation types — add/mul × cat-score/overall-score — with correct mechanics and visuals.

**Architecture:** Each Type B treat returns a new result shape (`scoreMultiplier`/`scoreBonus`); the `doFit` scan loop applies these directly to a running total and skips buffering; `runScoreSequence` renders four distinct animations based on the result shape.

**Tech Stack:** Vanilla JS, CSS animations, no build step.

---

## Classification Reference

| Type | Treats | Result shape |
|------|--------|-------------|
| Add Type A (per-cat) | milk, catnip, feather | `{bonus}` / `{bonusMap}` (unchanged) |
| Add Type B (score) | big_bite | `{scoreBonus: N}` |
| Mul Type A (per-cat) | cotton_cloud, tabby_pack, tuna_can, shadow_feast | `{gids, m}` (unchanged) |
| Mul Type B (score) | lone_kitty, purebred, all_or_nothing, catnado, wild_dice | `{scoreMultiplier: true, m}` |

---

## Task 1: CSS — four animation classes

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add keyframes and classes after the `.score-treat-flash` block (around line 217)**

Find the line `.score-treat-flash.on{opacity:1;}` and add immediately after it:

```css
/* ── Type A add: cyan per-cat pulse ── */
@keyframes cat-pulse-cyan{
  0%,100%{box-shadow:none;transform:scale(1);}
  40%{box-shadow:0 0 0 4px #38c0c0,0 0 18px 4px rgba(56,192,192,.65);transform:scale(1.16);}
}
/* ── Type A mul: gold per-cat pulse ── */
@keyframes cat-pulse-gold{
  0%,100%{box-shadow:none;transform:scale(1);}
  40%{box-shadow:0 0 0 4px #f5c200,0 0 18px 4px rgba(245,194,0,.65);transform:scale(1.16);}
}
.cat-pulse-add{animation:cat-pulse-cyan .6s ease-out forwards;}
.cat-pulse-mul{animation:cat-pulse-gold .6s ease-out forwards;}
/* ── Per-cat bonus badge ── */
.cat-bonus-badge{
  position:fixed;pointer-events:none;z-index:405;
  font-family:'Fredoka One',cursive;font-size:11px;font-weight:900;
  border-radius:50%;width:22px;height:22px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 6px rgba(0,0,0,.45);
  opacity:0;transform:scale(.5);
  transition:opacity .15s,transform .15s;
}
.cat-bonus-badge.show{opacity:1;transform:scale(1);}
.cat-bonus-badge.add{background:#38c0c0;color:#fff;}
.cat-bonus-badge.mul{background:#f5c200;color:#1a1a2e;}
/* ── Type B add: floating score badge ── */
@keyframes score-badge-float{
  0%{opacity:0;transform:translate(-50%,-4px) scale(.7);}
  30%{opacity:1;transform:translate(-50%,-20px) scale(1.05);}
  65%{opacity:1;transform:translate(-50%,-24px) scale(1);}
  100%{opacity:0;transform:translate(-50%,-40px) scale(.85);}
}
.score-float-badge{
  position:fixed;pointer-events:none;z-index:405;
  font-family:'Fredoka One',cursive;font-size:15px;
  background:#38c0c0;color:#fff;border-radius:20px;padding:3px 12px;
  white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,.35);
  animation:score-badge-float .9s ease-out forwards;
}
/* ── Type B mul: score slam ── */
@keyframes score-slam-out{
  0%{opacity:1;transform:scale(1);}
  100%{opacity:0;transform:scale(.6);}
}
@keyframes score-slam-in{
  0%{opacity:0;transform:scale(1.5);color:#f5c200;filter:drop-shadow(0 0 14px #f5c200);}
  55%{opacity:1;transform:scale(.95);color:#f5c200;}
  100%{opacity:1;transform:scale(1);color:#fff;filter:none;}
}
.score-slam-out{animation:score-slam-out .22s ease-in forwards;}
.score-slam-in{animation:score-slam-in .38s ease-out forwards;}
```

---

## Task 2: Update Type B mul treat files

**Files:**
- Modify: `js/treats/lone_kitty.js`
- Modify: `js/treats/purebred.js`
- Modify: `js/treats/all_or_nothing.js`
- Modify: `js/treats/catnado.js`
- Modify: `js/treats/wild_dice.js`

- [ ] **Step 1: Update `js/treats/lone_kitty.js`**

Replace entire file content:
```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: lone_kitty
//  ×2 score multiplier — req: no same-type cats adjacent
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['lone_kitty'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ({ scoreMultiplier: true, m });
  },
};
```

- [ ] **Step 2: Update `js/treats/purebred.js`**

Replace entire file content:
```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: purebred
//  ×2 score multiplier — req: all cats same type
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['purebred'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ({ scoreMultiplier: true, m });
  },
};
```

- [ ] **Step 3: Update `js/treats/all_or_nothing.js`**

Replace entire file content:
```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: all_or_nothing
//  ×1.5 score multiplier — req: board full
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['all_or_nothing'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => ({ scoreMultiplier: true, m });
  },
};
```

- [ ] **Step 4: Update `js/treats/catnado.js`**

Replace entire file content:
```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: catnado
//  ×N score multiplier, increases by increment each time played
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['catnado'] = {
  buildFn(ef, phase, addEf) {
    const baseM = extractMul(ef);
    let increment = 0;
    if (addEf) {
      const im = addEf.match(/([\d.]+)/);
      if (im) increment = parseFloat(im[1]);
    }
    return (b, cats, ts, p, cs) => {
      const plays = G.treatPlayCounts.catnado || 0;
      const m = Math.round((baseM + plays * increment) * 100) / 100;
      G.treatPlayCounts.catnado = plays + 1;
      return { scoreMultiplier: true, m };
    };
  },
};
```

- [ ] **Step 5: Update `js/treats/wild_dice.js`**

Replace entire file content:
```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: wild_dice
//  ×5 score multiplier — 1 in 6 trigger chance
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['wild_dice'] = {
  buildFn(ef, phase) {
    const m = extractMul(ef);
    return (b, cats, ts, p, cs) => {
      const triggered = Math.floor(Math.random() * 6) === 0;
      if (!triggered) return { scoreMultiplier: true, m: 1 };
      return { scoreMultiplier: true, m };
    };
  },
};
```

---

## Task 3: Update big_bite for Type B add

**Files:**
- Modify: `js/treats/big_bite.js`

- [ ] **Step 1: Replace entire file content**

```js
'use strict';
// ══════════════════════════════════════════════════════
//  TREAT: big_bite
//  +100 to score, -1 per cat already scored when treat fires
// ══════════════════════════════════════════════════════
TREAT_REGISTRY['big_bite'] = {
  isDecreasing: true,
  buildFn(ef, phase) {
    return (b, cats, ts, p, cs) => {
      const alreadyScored = G.cats.length - cats.length;
      const amt = Math.max(0, 100 - alreadyScored);
      return { scoreBonus: amt };
    };
  },
};
```

---

## Task 4: Update `doFit` scan loop in `scoring.js`

**Files:**
- Modify: `js/scoring.js`

- [ ] **Step 1: Replace the scan loop and total computation**

In `doFit`, find this block (lines ~29–85):
```js
const catScores={};
const scoredGids=new Set();
const treatBuffer=[];
const scanResults=[];

for(const item of allPieces){
  if(item.kind==='cat'){
    ...
  }else{
    ...
    treatBuffer.push({treat,result,phase:treat.tdef.phase});
    scanResults.push({kind:'treat',piece:treat,result,phase:treat.tdef.phase});
  }
}

// Sum finalized cat scores
const catTotal=Object.values(catScores).reduce((a,b)=>a+b,0);

// Board fill bonus
const filledCells=G.board.flat().filter(c=>c.filled).length;
const totalBoardCells=G.bsr*G.bsc;
const boardFull=filledCells===totalBoardCells;
const boardBonus=boardFull?totalBoardCells*(CFG.board_fill_bonus||5):0;

const total=catTotal+boardBonus;
```

Replace with:
```js
const catScores={};
const scoredGids=new Set();
const treatBuffer=[];
const scanResults=[];
let runningTotal=0;

for(const item of allPieces){
  if(item.kind==='cat'){
    const cat=item.piece;
    const base=cat.cells.length*10;
    let addBonus=0;
    let mulFactor=1;
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
    const futureCats=G.cats.filter(c=>!scoredGids.has(c.gid));
    const csCopy=Object.assign({},catScores);
    const result=treat.tdef.fn(G.board,futureCats,G.treats,treat.cells,csCopy)||{};

    if(result.scoreMultiplier){
      // Type B mul: apply to running total directly
      result.prevTotal=runningTotal;
      runningTotal=Math.round(runningTotal*result.m);
      result.newTotal=runningTotal;
    }else if(result.scoreBonus!==undefined){
      // Type B add: apply to running total directly
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
```

Note: the cat-scoring block was already inside the loop before but was shown in the original code — keep the original cat block identical, only the `else` branch and post-loop total change.

---

## Task 5: Update `runScoreSequence` animation

**Files:**
- Modify: `js/scoring.js`

- [ ] **Step 1: Add helper `flashCatCells` after `flashTreat`**

After the closing `}` of `flashTreat` (around line 358), add:

```js
function flashCatCells(seq,boardEl,gids,catsSnapshot,bsc,phase){
  const color=phase==='add'?'#38c0c0':'#f5c200';
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
    const label=phase==='mul'?'×':'+'
    badge.style.left=(rect.right-11)+'px';
    badge.style.top=(rect.top-11)+'px';
    seq.appendChild(badge);
    setTimeout(()=>badge.classList.add('show'),20);
    setTimeout(()=>{badge.classList.remove('show');},550);
    setTimeout(()=>badge.remove(),800);
  });
}
```

- [ ] **Step 2: Add helper `animateScoreSlam` after `flashCatCells`**

```js
function animateScoreSlam(scoreEl,newVal,baseScoreBeforeHand){
  if(!scoreEl)return;
  scoreEl.classList.add('score-slam-out');
  setTimeout(()=>{
    scoreEl.classList.remove('score-slam-out');
    scoreEl.textContent=(baseScoreBeforeHand+newVal).toLocaleString();
    scoreEl.classList.add('score-slam-in');
    setTimeout(()=>scoreEl.classList.remove('score-slam-in'),420);
  },220);
}
```

- [ ] **Step 3: Add helper `animateScoreFloatBadge` after `animateScoreSlam`**

```js
function animateScoreFloatBadge(seq,scoreEl,text,baseScoreBeforeHand,newVal){
  if(!scoreEl)return;
  scoreEl.style.color='#38c0c0';
  scoreEl.textContent=(baseScoreBeforeHand+newVal).toLocaleString();
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
```

- [ ] **Step 4: Update the treat step handler inside `runScoreSequence`**

Find the treat step builder inside `scanResults.forEach` — the block starting with:
```js
steps.push({
  kind:'treat',
  explain:`${treat.tdef.em} ${treat.tdef.nm}: "${treat.tdef.ef}"`,
  run(){
    flashTreat(seq,boardEl,treat,G.bsc);
    addLogLine(logDiv,logLine);
  }
});
```

Replace with:
```js
steps.push({
  kind:'treat',
  explain:`${treat.tdef.em} ${treat.tdef.nm}: "${treat.tdef.ef}"`,
  run(){
    flashTreat(seq,boardEl,treat,G.bsc);
    addLogLine(logDiv,logLine);

    if(phase==='mul'&&result.scoreMultiplier){
      // Type B mul: score slam
      if(result.m!==1){
        animateScoreSlam(scoreEl,result.newTotal,baseScoreBeforeHand);
        displayedScore=result.newTotal;
      }
    }else if(phase==='add'&&result.scoreBonus!==undefined){
      // Type B add: floating badge
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
```

---

## Task 6: Commit and push

- [ ] **Step 1: Stage and commit**

```bash
git add js/treats/lone_kitty.js js/treats/purebred.js js/treats/all_or_nothing.js js/treats/catnado.js js/treats/wild_dice.js js/treats/big_bite.js js/scoring.js styles.css
git commit -m "Distinguish add/mul × cat-score/score animations and mechanics"
```

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-Review Notes

- `wild_dice` with `m:1` (no trigger) still fires as Type B mul but `animateScoreSlam` is guarded with `result.m!==1`, so no visual noise on non-triggers.
- `catnado` at base `×1` likewise skips the slam animation on first play.
- `flashCatCells` removes/re-adds the pulse class using `offsetWidth` to force reflow so re-triggers work correctly.
- `animateScoreSlam` uses fixed 220ms for out + 380ms for in — these must match the CSS keyframe durations exactly (`score-slam-out: 0.22s`, `score-slam-in: 0.38s`).
- The `logLine` construction for Type B treats in `runScoreSequence` should be updated to reflect the new result shapes. The existing `phase==='mul'` branch checks `result.gids` — add guards for the new shapes so the log line still renders cleanly. (The existing fallthrough produces an empty suffix, which is acceptable.)
