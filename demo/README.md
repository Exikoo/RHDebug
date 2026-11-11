# The demo — a from-scratch rebuild of the first LoD screen

This folder is a **standalone bot** that does one thing: the very first
Legends-of-Discord prototype screen, the one shown in the demo gif.

```bash
npm run demo        # same DISCORD_TOKEN as the main bot — run one at a time
```

Then in any channel: `/demo` (slash) or `!demo` (prefix).

## What it draws

```
┌──────────────────────────────────┐
│ Hamzalopode                      │   panel 1
│ HP: 10/10        Mana: 6/6       │
│ 🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥   🟦🟦🟦🟦🟦🟦   │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩      │   panel 2: the field
│ 🟩🟩🟩🟩🟩🟩🟩🟩🧍🟩🟩🟩🟩🟩🟩🟩      │
│ ...                              │
│ x: 8, y: 7, area:                │   footer
└──────────────────────────────────┘
  7   ·   ·   ·         <- the number pad *is* the compass
  6   ·   1   ·
  5   4   2   3
  -1  Hamzalopode#7830
```

The gif's field is a rendered image. This bot keeps the project's rule that
nothing in-game is an image: the field is a grid of the uploaded `grass`
emoji with the `player` emoji standing on it, and the bars are one coloured
square per point (`🟥`/`🟦`, `⬛` for the missing points).

## How the pad moves you

The layout on screen is the map, so the pad is read as a compass:

| Cell | | Cell | |
| --- | --- | --- | --- |
| `7` | north-west | blank above `4` | **north** |
| `6` | west | `1` | north-east |
| `5` | south-west | `4` | south |
| `2` | south-east | `3` | east |
| `-1` | step back one move | name plate | disabled, just a label |

`8` and `9` were never on the original pad, so north sits on the empty cell
above `4` — it still looks blank, exactly like the gif, and it walks.

The field is 24 × 14 tiles shown through a 16 × 7 window. The window only
slides when you reach its edge, so a step is always visible.

## Files

| File | What it is |
| --- | --- |
| `world.js` | field, spawn, vitals, compass, camera, movement + undo |
| `view.js` | the two embeds and the 4 × 4 pad |
| `handler.js` | button routing (`applyButton` is pure), `/demo` opener |
| `store.js` | one in-memory game per player, pruned after an hour idle |
| `index.js` | the client: slash command, prefix command, button listener |

No database and no profiles: restart the bot and everybody is back on
`x: 8, y: 7`.

## Tests

```bash
npm run test:demo     # node scripts/check-demo.mjs
```

Thirteen checks: both panels, the bar maths, the 16 × 7 window with exactly
one sprite, the 4 × 4 pad with `-1` and the disabled name plate, all eight
directions against the layout, undo, edge blocking, the camera, per-player
isolation and idle pruning.
