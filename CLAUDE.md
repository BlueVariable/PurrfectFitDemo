# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

No build step required. Open `purrfect-fit-demo.html` directly in a modern browser. There are no npm packages, build tools, or dependencies.

Configuration is loaded at runtime from a Google Apps Script endpoint (Google Sheets). A "↺ Reload Config" button on the title screen re-fetches it. Hardcoded fallback config kicks in automatically if the fetch fails.

## Architecture

The entire game lives in a single file: `purrfect-fit-demo.html` (~2,500 lines). It is structured with clearly marked sections using `// ════` headers:

- **GOOGLE SHEETS CONFIG** — Loads and parses all game data from 6 Sheets tabs into global constants (`CFG`, `RCFG`, `COLS`, `EMS`, `TDEFS`, `CSHAPES`, `DECKS`)
- **STATE** — Global mutable state in two objects: `G` (game state) and `H` (held/dragging state)
- **HELD MECHANICS** — Mouse/touch drag-and-drop logic for picking up and rotating cats and treats
- **BOARD INTERACTION** — Placement validation (`boardCanPlace`) and committing pieces
- **BACKPACK INTERACTION** — Inventory grid management
- **RENDER** — All DOM updates (`renderAll`, `renderBoard`, `renderHand`, `renderBP`, `renderShopFull`)
- **SCORING** — Animated score sequence with four phases: base → add treats → mul treats → board fill bonus
- **SHOP** — Treat purchasing and reroll logic
- **TREAT EFFECTS** — `buildTreatFn(id, ef, phase)` parses effect strings from config into executable functions
- **UTILS** — `rotC` (shape rotation), `sfl` (shuffle), `mkDeck`, `dealHand`

## Key Data Structures

**`G` (game state):**
```
round, score, tgt, bsr/bsc (board dims), earn, hands, disc, cash,
deckId, deck[], hand[], board[][] (2D grid of cells), bp[][] (backpack),
bpGroups[], cats[], treats[]
```

**`H` (held piece):**
```
kind ('cat'|'treat'|'shop-treat'|null), source, data,
cells (2D shape), rot (0-3), color, em, handIdx/boardGid/bpGid,
grabDr/grabDc (grab offset within shape), dragging
```

**Board cell:** `{ filled, col, kind, em, gid, shape, type }`

## Screen Flow

`s-loading` → `s-title` (deck select) → `s-rounds` (round info + shop) → `s-game` (gameplay) → `s-shop` (between rounds)

Screens are `display:none` by default and made visible with class `.on`.

## Gameplay Loop

`doFit()` triggers the score sequence → `runScoreSequence()` animates phases → `endScoreSequence()` checks win/loss → `roundWin()` or next hand dealt via `dealHand()`.

## Configuration Data Source

`purrfect_config.xlsx` is a reference/editing artifact. The live data source is Google Sheets, fetched via:
```
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/...'
```
To change game balance, edit the Google Sheet and reload config in-browser (or update the hardcoded fallback around line 898).
