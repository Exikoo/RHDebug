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
| Character sheet and bag | `utils/menuDisplays.js` |
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

## Gameplay bits that support the look

- **Level ups**: XP curve `10 + 15 × (level − 1)`, +5 HP and +1 attack/defense
  per level, full heal, `⭐ Level up!` line in the activity strip. Before this
  `/map` showed `Lv. 1` forever because nothing ever levelled the player up.
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
