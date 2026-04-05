# Treat Animation Type Distinction — Design Spec
Date: 2026-04-06

## Overview

Treats fall into two mechanical categories per phase (add and mul). Animations must visually distinguish these so the player can immediately understand what each treat is doing.

## The Four Types

| Phase | Target | Color | Animation |
|-------|--------|-------|-----------|
| add | individual cat score | Cyan | Matching cat cells pulse cyan + cyan +N badge; score counter glows cyan + floating +N |
| add | overall score | Cyan | Score counter glows cyan + floating +N badge rises and fades |
| mul | individual cat score | Gold | Matching cat cells pulse gold + gold ×N badge |
| mul | overall score | Gold | Old score number shrinks out → new number slams in gold, settles white |

## Treat Classification

### Add Type A — individual cat score
- milk (+10 to ALL cats)
- catnip (+30 to cats in same ROW)
- feather (+30 to cats in same COL)

### Add Type B — overall score
- big_bite (+100, -1 per cat already scored)

### Mul Type A — individual cat score
- cotton_cloud (×2 all WHITE cats)
- tabby_pack (×2 all TABBY cats)
- tuna_can (×2 all ORANGE cats)
- shadow_feast (×2 all BLACK cats)

### Mul Type B — overall score
- lone_kitty (×2)
- purebred (×2)
- all_or_nothing (×1.5)
- catnado (×1, scaling)
- wild_dice (×5)

## Classification Rule
- Effect text contains "all [TYPE] cats" or "to [target] cats" → Type A (individual cat)
- Effect text is just "+N" or "×N" (no cat type qualifier) → Type B (overall score)

## Mechanic Changes

Currently ALL treats in mul/add phase work by buffering per-cat adjustments. Type B treats need new mechanics:

### Add Type B
- At scan position, apply bonus directly to `runningTotal` (not buffered)
- `result` shape: `{ scoreBonus: N }` (no `bonus`/`bonusMap`)
- Do NOT push to `treatBuffer` (no effect on future cat scores)

### Mul Type B
- At scan position, multiply `runningTotal` directly
- `result` shape: `{ scoreMultiplier: true, m: N, prevTotal: X, newTotal: Y }`
- Do NOT push to `treatBuffer` (no effect on future cat scores)

## Animation Changes

### In `runScoreSequence`

**Treat Type A (add or mul):**
- Flash treat cells (existing `flashTreat`)
- Additionally: for each `result.gids` cat still on the board, pulse that cell with:
  - Add: cyan glow (`#38c0c0`) + "+N" badge
  - Mul: gold glow (`#f5c200`) + "×N" badge
- Badges appear in top-right corner of each cell, fade after 600ms

**Treat Type B add (`result.scoreBonus`):**
- Flash treat cells
- Score counter glows cyan, floating "+N" badge rises from it and fades

**Treat Type B mul (`result.scoreMultiplier`):**
- Flash treat cells
- Old score number shrinks/fades out
- New score number slams in gold, then settles white

## Detection Logic (in `runScoreSequence`)

```
if phase === 'add':
  if result.bonusMap or result.bonus → Type A add
  if result.scoreBonus → Type B add
if phase === 'mul':
  if result.gids → Type A mul
  if result.scoreMultiplier → Type B mul
```

## Files to Change

- `js/scoring.js` — scan loop mechanics for Type B, animation steps for all four types
- `js/treats/*.js` — Type B mul treats need to return `{ scoreMultiplier: true, m, prevTotal, newTotal }` instead of `{ gids, m }`
- `styles.css` — new keyframes for cyan pulse, floating badge, and (if not already present) the score slam
