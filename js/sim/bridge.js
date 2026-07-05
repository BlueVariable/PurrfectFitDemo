'use strict';
// ══════════════════════════════════════════════════════
//  SIM: iframe bridge
//
//  This file is NEVER referenced by index.html and is NOT loaded by
//  sim.html's own <script> tags. js/sim/engine.js injects it at runtime by
//  creating <script src="js/sim/bridge.js"> INSIDE the game iframe's own
//  document, after the iframe has finished loading.
//
//  Why this has to run *inside* the iframe rather than just being read from
//  the parent: the game's state (`G`, `H` in js/state.js) and config
//  (`TDEFS`, `CFG`, `RCFG`, `BRANCHES`, `DECKS`, `COLS`, `EMS` in
//  js/config.js) and `shopPool`/`gameInProgress` (js/shop.js, js/state.js)
//  are all declared with `let`/`const` at the top level of a classic
//  <script>. Per the ECMAScript spec, top-level `let`/`const` bindings live
//  in the global *lexical* (Declarative) environment record, NOT on the
//  global object — unlike `var` and function declarations, which mirror
//  onto `window`. That means `iframe.contentWindow.G` is `undefined` even
//  though the game code's own bare `G` references resolve fine. (Ordinary
//  function declarations like `placeCatOnBoard`, `doFit`, `rotC`,
//  `selectBranch`, `boardCanPlace`, `bpCanAt`, `getBPR`/`getBPC`, etc. DO
//  mirror onto `window` and are called directly from the parent as
//  `iframeWindow.doFit()` etc. — no bridge needed for those.)
//
//  This bridge script executes in the SAME document/realm as the game's
//  own scripts (because it's just another <script> tag added to that
//  document), so its bare references to G/H/TDEFS/... resolve through the
//  shared lexical scope. It exposes them via `window.SIM_BRIDGE`, which IS
//  a plain property assignment and therefore reachable from the parent as
//  `iframeWindow.SIM_BRIDGE`.
//
//  Only read accessors are exposed. Callers should mutate returned objects
//  (G, H, are shared live references — mutating their properties, e.g.
//  `bridge.getG().selBpGid = gid`, is legitimate and is exactly how the
//  solver applier and shop-buy helper drive the real game state) but should
//  otherwise prefer calling the game's real functions (placeCatOnBoard,
//  doFit, shopDropOnBP, ...) directly on the iframe window rather than
//  poking state by hand, to keep every game transition authentic.
// ══════════════════════════════════════════════════════
(function(){
  window.SIM_BRIDGE = {
    getG: function(){ return G; },
    getH: function(){ return H; },
    getTDEFS: function(){ return TDEFS; },
    getRCFG: function(){ return RCFG; },
    getCFG: function(){ return CFG; },
    getBRANCHES: function(){ return BRANCHES; },
    getDECKS: function(){ return DECKS; },
    getShopPool: function(){ return shopPool; },
    isGameInProgress: function(){ return gameInProgress; },
    // Mirrors the localStorage cache-check hash used by loadConfig()/
    // reloadConfig() in js/config.js (_cfgHash), so the sim can stamp
    // exported results with the config version that produced them.
    getConfigHash: function(){
      try{
        var raw = localStorage.getItem(CONFIG_CACHE_KEY);
        if(!raw) return null;
        var parsed = JSON.parse(raw);
        return (parsed && parsed.hash) || null;
      }catch(e){ return null; }
    },
    ready: true
  };
})();
