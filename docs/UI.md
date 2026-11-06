# RuneHero — UI notes (Legends-of-Discord style screen)

The map is **not an image**: the screen is a grid of custom emojis, one per
tile, rows joined with newlines inside the embed description. The 32px pixel
art comes from the uploaded emojis themselves (the DCSS tileset in `tileset/`
is the source for them), and the emoji IDs in `config/mapConfig.js` match the
tileset filenames one-to-one — `stone_brick_1`, `tree_on_grass`,
`shoals_deep_water_1_shape`, `blood_puddle_red_4`, …

This is also why the classic LoD screen is **16×7**: an embed description is
capped at 4096 characters and every `<:name:id>` costs 28–48 of them.

## Screen layout

```
Vlad's score: 287              <- embed title
```The City of RuneHero```       <- centred area band (code block = dark strip)
🟩🟩🟩🟩🟩🟩🌲🟩 ...            <- the emoji grid, 16 x 7
Lv. 3      HP        MP        <- compact stat row
12/40 XP   118/130   0/0
Bag slots  Gold
4/8        275 🪙
> activity line                <- always exactly four lines
> ...
```

| Part | Where it lives |
| --- | --- |
| Emoji grid + viewport | `utils/mapRenderer.js` |
| Score title, area band, stat row, activity strip | `utils/screen.js`, `utils/uiTheme.js` |
| D-pad and utility buttons | `utils/buttonComponents.js` |
| Character sheet, talent screen and bag | `utils/menuDisplays.js` |
| Talent tree layout / effects / point rates | `config/talents.js` |
| Talent ranks, bonuses, learn + attribute spend | `utils/talents.js` |
| Bag slot emoji IDs | `config/emojiIds.js` |
| XP curve, level ups, vitals clamping | `utils/progression.js` |
| Startup emoji validation | `utils/emojiCheck.js` |
| One-command entry point | `Command/Interactions/start.js` |

## What changed in the grid itself

**The description limit was a real bug waiting to happen.** City rows cost
3817 characters of the 4096 budget — only ~280 spare. One row of 16 water
tiles (`<:shoals_deep_water_1_shape:…>` is 48 characters each) costs 768, so a
water-heavy map would have blown the limit and `setDescription` would throw,
killing the whole screen. `renderMapView()` now:

- keeps the screen at a fixed `VIEW_WIDTH × VIEW_HEIGHT` (16×7) and **scrolls a
  camera window** centred on the player instead of resizing per map — a 30×20
  map shows a stable 16×7 view;
- **shrinks the window until the markup fits** the description budget (the
  16×7 all-water map above renders as 11×7 instead of failing);
- clamps the player marker instead of mutating `player.location` mid-render
  (the old renderer moved the player object and never saved it, so the screen
  and the database could disagree);
- falls back to a wall tile for unknown tiles so row alignment never breaks.

**Per-class avatars are config-ready.** Fill in `PLAYER_EMOJI_BY_CLASS` in
`config/mapConfig.js` with e.g. `<:player_warrior:…>` and each class gets its
own tile; anything left `null` uses `EMOJI_MAP.P`.

**Startup emoji health check.** `utils/emojiCheck.js` runs on `clientReady`
and warns about malformed IDs, emojis the bot cannot see (not in any of its
servers — the usual cause of the grid turning into raw `<:grass:123…>` text),
and monster types in `monsterManager.js` that have no emoji yet
(`ORC`, `DRAGON` currently fall back to a wall).

## Bag screen

Same one-emoji-per-cell rule as the map, so an empty cell and a filled cell
occupy exactly one slot in the row:

```
Vlad's bag                     <- embed title
```Inventory```               <- dark band
🅱️🅱️🅱️🅱️🅱️🅱️🅱️🅱️            <- 1 emoji per slot, filled = framed item
**Bag slots**
2/8
>Details of the item
Warrior's Broadsword
A heavy sword perfect for frontline combat
+8 attack
```

Buttons follow the reference layout:

```
row 1   Start | Trash | [selected item] | Use | Select
row 2   slot 1 | slot 2 | slot 3 | slot 4 | ↩
row 3   slot 5 | slot 6 | slot 7 | slot 8 | Quit
```

Start opens the character sheet, Select equips the highlighted gear, Use
consumes/equips, the emoji button previews the selection.

What it looks like: [`docs/emojis/bag-mock.png`](emojis/bag-mock.png) (rendered
with the real emoji art).

The 11 slot emojis are generated from the tileset and live in
[`docs/emojis/`](emojis/README.md) with an upload table: `slot_empty` plus one
`slot_<itemId>` per item in `config/items.js`. Each filled cell is
`misc/slot.png` (frame, recoloured so it is visible on Discord's dark embed)
with the item art inset to 26/32, exported at 128×128. Paste the IDs into
`config/emojiIds.js`; `/emojis upload` (administrator) uploads the files and
prints the block to paste. Until then the bag falls back to unicode glyphs and
the startup check lists exactly what is missing.

## Character screen

Pixel-for-pixel copy of the reference sheet — the panel is 5 rows of buttons,
so it uses every row Discord allows.

```
Hamzalopode's character            <- embed title
```Character screen```             <- dark band
[4 bag tiles]                      <- top strip: the first four items in the bag
🧍 Hamzalopode Human
**Attributes** - Point left: 3
[bracket] STR:    10               <- red corner brackets down the list
[bracket] INT:  5452
[bracket] VIT:   727
[bracket] DMG:     1
**Talents** - Point left: 0
Nothing
**Gear**
      [armor] [sword] [amulet]     <- white glyphs, one per panel
▫️▫️ ▫️ ▫️▫️                        <- equipped item in the first cell
▫️▫️ ▫️ ▫️▫️
**Bags**
▫️▫️▫️▫️▫️
                                    <- blank line
**Hp** 1.0                          <- health potions carried
**Lv. 1**   **HP**   **MP**
_0 / 10_   _7545 / 7545_   _6 / 6_
**Bag slots max**
8
```

The button panel, top to bottom:

| Row | Buttons | Actions |
| --- | --- | --- |
| 1 | `Start` (green) · weapon · armour · accessory tiles · `Select` (green) | Start → map, tiles → ephemeral item card, Select → bag |
| 2 | sheet tile (disabled) · ⭐ talents · 2 blanks · bag tile | navigation |
| 3 | bone · 3 blanks · `Quit` (red) | bone drinks the first healing potion, Quit ends the run |
| 4 | `Add an attribute:` (disabled) · `STR` `INT` `VIT` (blue) | spends one attribute point |
| 5 | 3 blanks · ✅ · ❌ | ✅ → map, ❌ → quit |

Row 1 and row 5 share actions with row 2/3 (bag, map, quit) but **never share a
`custom_id`**: Discord rejects a whole message with `50035
COMPONENT_CUSTOM_ID_DUPLICATED`, and you only find out when someone presses a
button. `map_char_bag`, `map_char_done` and `map_char_quit` are aliases routed
to the same handlers; `node scripts/check-buttons.mjs` re-checks every panel
for duplicate ids and over-long rows.

Gear is three panels side by side — 2×2 armour, 2×1 weapon, 2×2 accessory —
one emoji per cell, so the grids line up whatever is equipped. Index 0 of each
panel is the equipped item; until the slots exist in the profile the rest stay
empty frames.

Where the points come from: `POINTS_PER_LEVEL` in `config/talents.js` — one
attribute point per level, one talent point every second level (both granted in
`utils/progression.js`, both stored on the profile so nothing is recomputed or
lost). Class attributes (`config/classes.js` → `attributes`) are the starting
numbers; spent points are added on top of them, and only the spent part touches
`baseStats`, so combat math stays identical to before the screens existed.

## Talent screen

```
```Talent screen```
[4 bag tiles]
**Point left:** 3

 4 ⠀⠀⠀🟨⠀⠀⠀          <- tier number on the left, 0 at the bottom
 3 ⠀⠀⠀│⠀⠀⠀
 2 ⠀⬛─⬛─⬛⠀
 1 ⠀│⠀│⠀│⠀
 0 ⠀⬛⠀⬛⠀⬛⠀

**Talent description**
**Brute Force** — rank 1/5
+2 attack per rank
*Requires Adventurer's Resolve*
```

Node states map to one emoji each: `talent_node_off` (black cell, blocked),
`talent_node_available` (dark red with a red ✕), `talent_node_on` (green),
`talent_node_max` (gold frame), `talent_node_focus` (gold frame + ✕, the node
being described). Connectors are the grey `talent_link_h` / `talent_link_v`,
empty cells are the invisible `talent_blank`; every one is a single emoji so
the tree cannot shift.

The grid is `TREE_LAYOUT` in `config/talents.js` — `N` is a node, `-` and `|`
are links, `.` is empty; row 0 is printed at the bottom, like the game. Adding
a talent means one entry in `TALENTS` plus its id in the matching cell: the
renderer, the buttons, the prerequisite checks and the combat bonuses all read
from that table. Bonuses are **derived** (`talentBonuses()`), never stored, so a
respec or a reload can never leave a stale number in the database.

Panel: `Start` · three talent buttons · `Learn` (green), then four more talent
buttons · the sheet tile, then `Quit`. The selected node is kept per user for
five minutes so re-renders keep the description open.

## Gameplay bits that support the look

- **Level ups**: XP curve `10 + 15 × (level − 1)`, +5 HP and +1 attack/defense
  per level, full heal, `⭐ Level up!` line in the activity strip. Before this
  `/map` showed `Lv. 1` forever because nothing ever levelled the player up.
  **No level cap** — `MAX_LEVEL` is 9999 purely so a corrupted XP value cannot
  spin the level-up loop.
- **Points on level up**: +1 attribute point every level, +1 talent point
  every second level (`POINTS_PER_LEVEL` in `config/talents.js`).
- **Defeat**: at 0 HP the player wakes up in the city at full health, losing
  10% gold — no more permanently stuck 0-HP sessions.
- **Quit** works (it was a permanently disabled button).
- **`/start`** is the only command a new player needs: class, race, gender and
  difficulty on one panel, then `▶ Play` opens the screen. `/map` and `/help`
  are no longer Administrator-only.
- **`/map` title** no longer hardcodes "The City of RuneHero" while you are
  standing in the plains.

## Next steps for full parity

1. **Upload the missing monster emojis** (`orc`, `red_dragon`) and the per-class
   player emojis — the startup check will nag until they exist.
2. **Death screen / run score** — LoD ends a run and posts a score.
   `Permadeath` exists in the schema but is not enforced.
3. **Real shop** — the shop screen is still a "COMING SOON" placeholder.
4. **Dungeon floors with a boss every 5 levels** — `areaLabel(map, depth)`
   already renders a `Depth N` suffix.
5. **Quests / NPC dialogue** — `map.events` models them; actions only print a
   description.
6. **Skills and status effects** — `Profile.skills` is an empty array; combat
   is still one exchange per step.
7. **Trading / marketplace / auction house**, guilds, friends, rankings,
   achievements, professions, dungeons and the open world — the screens above
   are the shell these hang off; none of them exist yet.
8. **More talents** — the tree holds 7 nodes today (`config/talents.js`); a
   LoD-sized tree is ~30, laid out by editing `TREE_LAYOUT`.
