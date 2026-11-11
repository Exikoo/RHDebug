# Emojis to upload

49 names in total: 28 original, 9 built from the tileset by
`npm run build:emojis`, 11 optional icons and 1 gold counter (see the tables).

Three sets, all generated from `tileset/` (or drawn as UI chrome) and named
`slot_*` / `talent_*` / chrome names, so the code finds them without any extra
mapping. **28 files in total.**

Preview of the 17 character-sheet + talent-screen ones:
[`preview-ui.png`](preview-ui.png).

## Bag emojis — upload list

Eleven 128×128 PNGs, generated from `tileset/` so a filled slot and an empty
slot are both **exactly one emoji wide**. That is what keeps the inventory row
aligned (the same reason the map works as an emoji grid).

Preview: [`preview.png`](preview.png) (all 11, labelled).

| # | File to upload | Emoji name | Used for | Built from |
| --- | --- | --- | --- | --- |
| 1 | `slot_empty.png` | `slot_empty` | empty bag cell | `misc/slot.png` (frame, recoloured grey) |
| 2 | `slot_warrior_sword.png` | `slot_warrior_sword` | Warrior's Broadsword | `item/weapon/long_sword1.png` |
| 3 | `slot_mage_staff.png` | `slot_mage_staff` | Apprentice's Staff | `item/weapon/quarterstaff2.png` |
| 4 | `slot_ranger_bow.png` | `slot_ranger_bow` | Hunter's Bow | `item/weapon/ranged/longbow1.png` |
| 5 | `slot_warrior_armor.png` | `slot_warrior_armor` | Plate Armor | `item/armour/plate1.png` |
| 6 | `slot_mage_robe.png` | `slot_mage_robe` | Enchanted Robe | `item/armour/robe2.png` |
| 7 | `slot_ranger_leather.png` | `slot_ranger_leather` | Ranger's Leathers | `item/armour/leather_armour1.png` |
| 8 | `slot_health_potion.png` | `slot_health_potion` | Health Potion | `item/potion/ruby.png` |
| 9 | `slot_mana_potion.png` | `slot_mana_potion` | Mana Potion | `item/potion/sky_blue.png` |
| 10 | `slot_bandage.png` | `slot_bandage` | Bandage | `item/book/cloth.png` |
| 11 | `slot_arrows.png` | `slot_arrows` | Arrows | `item/weapon/ranged/arrow1.png` |

Naming matters: the code looks up `slot_<itemId>` using the key from
`config/items.js`. Adding an item means generating one more
`slot_<itemId>.png` and adding a line to `config/emojiIds.js`.

## How each file was made

```text
frame      = tileset/misc/slot.png, border recoloured to #5d626b
             (the original #1a1a1a is invisible on Discord's dark embed)
empty cell = frame
item cell  = frame + item sprite scaled to 26/32 and centred
             (leaves the frame visible around the art, like the reference)
output     = 32x32 → 128x128 nearest-neighbour, transparent background
```

# Talent / character emojis — upload list

Nine 128×128 PNGs for the talent screen. Preview: [`preview-ui.png`](preview-ui.png).

| # | File to upload | Emoji name | Used for | Art |
| --- | --- | --- | --- | --- |
| 12 | `talent_node_off.png` | `talent_node_off` | node not learned, prerequisite missing | dark stone tile |
| 13 | `talent_node_available.png` | `talent_node_available` | can be learned right now | gold tile |
| 14 | `talent_node_on.png` | `talent_node_on` | learned (rank ≥ 1) | green tile |
| 15 | `talent_node_max.png` | `talent_node_max` | learned to max rank | white tile |
| 16 | `talent_node_focus.png` | `talent_node_focus` | node whose description is shown | gold, lit |
| 17 | `talent_link_h.png` | `talent_link_h` | horizontal connector between nodes | — |
| 18 | `talent_link_v.png` | `talent_link_v` | vertical connector between nodes | — |
| 19 | `talent_blank.png` | `talent_blank` | empty tree cell (keeps the grid aligned) | — |
| 20 | `tab_talents.png` | `tab_talents` | "Talents" tab button | ⭐ tile |

Every cell of the 7×5 talent grid is exactly one emoji, so the tree keeps its
shape no matter which node state it is in. Uploading all nine is what makes
the tree look like the reference; without them it falls back to
⬛ / 🟨 / 🟩 / ⬜ / ⭐ and still works.

# Character sheet emojis — upload list

The eight tiles that build the character panel (8, 9, … keep numbering).

| # | File to upload | Emoji name | Used for |
| --- | --- | --- | --- |
| 21 | `tab_character.png` | `tab_character` | gold "II" sheet button (row 2, left) |
| 22 | `ui_use.png` | `ui_use` | bone = "drink a healing potion" button |
| 23 | `ui_check.png` | `ui_check` | green ✅ confirm tile (row 5) |
| 24 | `ui_cross.png` | `ui_cross` | red ❌ cancel tile (row 5) |
| 25 | `attr_bracket.png` | `attr_bracket` | red corner brackets down the STR/INT/VIT list |
| 26 | `gear_icon_armor.png` | `gear_icon_armor` | label above the 2×2 armour panel |
| 27 | `gear_icon_weapon.png` | `gear_icon_weapon` | label above the 2×1 weapon panel |
| 28 | `gear_icon_accessory.png` | `gear_icon_accessory` | label above the 2×2 accessory panel |

`ui_check` / `ui_cross` / `attr_bracket` / `tab_character` are drawn with SVG,
the three `gear_icon_*` are bright-pixel glyphs of a tileset plate, sword and
amulet (so they read as white icons on the dark embed).

# Profession / feature emojis — upload list

These eleven are purely optional polish: every one of them falls back to the
unicode glyph in brackets, and the screens are designed around that fallback,
so nothing breaks while the slots are `null`.

| # | Emoji name | Used for | Fallback |
| --- | --- | --- | --- |
| 29 | `prof_mining` | Mining profession line + gather button | ⛏️ |
| 30 | `prof_woodcutting` | Woodcutting line + button | 🪓 |
| 31 | `prof_fishing` | Fishing line + button | 🎣 |
| 32 | `prof_herbalism` | Herbalism line + button | 🌿 |
| 33 | `prof_smithing` | Smithing bench + professions map button | 🔨 |
| 34 | `prof_crafting` | Crafting bench | 🧵 |
| 35 | `prof_cooking` | Cooking bench | 🍳 |
| 36 | `ui_quests` | map row → quest board | 📜 |
| 37 | `ui_market` | map row → player market | 🏪 |
| 38 | `ui_trophy` | map row → achievements | 🏆 |
| 39 | `ui_ranks` | map row → rankings | 🏅 |

Reuse one of the existing tiles if you upload custom art: the four `ui_*` read
best as a single bright glyph on the dark panel, and the seven `prof_*` as a
32×32 tileset glyph scaled to 128×128 (same pipeline as the bag cells).

# Demo / tile emojis — built from the tileset

`npm run build:emojis` writes these straight out of `tileset/` (32 → 128 px,
nearest neighbour so the pixels stay sharp). Re-run it after changing the
tileset; nothing else needs editing, the names are already in
`config/emojiIds.js`.

| # | File | Emoji name | Used for | Built from |
| --- | --- | --- | --- | --- |
| 29 | `demo_grass_1.png` | `demo_grass_1` | demo field, base tile | `dngn/floor/grass/grass0.png` |
| 30 | `demo_grass_2.png` | `demo_grass_2` | demo field speckle (1 in 6) | `dngn/floor/grass/grass-dark0.png` |
| 31 | `demo_player.png` | `demo_player` | the walking sprite | `player/base/human_m.png` |
| 32 | `tile_rock.png` | `tile_rock` | boulder on the plain | `item/misc/misc_stone.png` |
| 33 | `tile_chest.png` | `tile_chest` | treasure chest | `item/misc/misc_box_of_beasts.png` |
| 34 | `bar_hp.png` | `bar_hp` | one HP point | drawn, tileset palette |
| 35 | `bar_hp_empty.png` | `bar_hp_empty` | one spent HP point | drawn, tileset palette |
| 36 | `bar_mana.png` | `bar_mana` | one Mana point | drawn, tileset palette |
| 37 | `bar_mana_empty.png` | `bar_mana_empty` | one spent Mana point | drawn, tileset palette |

The DCSS set has no health/mana bar of its own, so those four are drawn as a
dark frame with a lit top edge and a shaded bottom, in the gif's red
(`#b3382f`) and blue (`#2f6fd0`) — one emoji per point, ten of them for
`HP: 10/10`.

## How the talent tiles were made

```text
canvas   = 32x32, transparent
frame    = rounded rect, 1px inset, 3px thick  (state colour)
inner    = frame + 3px inset                   (state fill)
marks    = on: darker green centre • max: green centre + gold pip
           focus: amber centre + pale pip
output   = 32x32 → 128x128 nearest-neighbour, PNG
links    = 24x6 (h) / 6x24 (v) dark red bar, centred in a 32x32 canvas
blank    = fully transparent 128x128 (an empty cell that still takes one
           emoji's width, so the grid cannot shift)
```

State colours (matched to the reference screen): off `#17191d` with a light
grey edge, available `#4a1414` with a red ✕, on `#2f7d3b`, max `#3f9d4a` with a
gold frame and pip, focus `#7a2418` with a gold frame. Links are light grey
(`#c9ced6`), not red, so the tree reads like the game's.

## After uploading

Two ways to get the IDs in place.

**Automatic (recommended)** — the bot ships an admin command that does both
the upload and the ID collection:

```
/emojis upload     # uploads any missing docs/emojis/*.png as application emojis
```

It uploads every `docs/emojis/*.png` that is not in the application yet and
replies with two ready-to-paste objects:

```js
export const SLOT_EMOJI_IDS = {
  slot_empty: "1234567890123456789",
  slot_warrior_sword: "1234567890123456790",
  // ...
};

export const UI_EMOJI_IDS = {
  talent_node_off: "1234567890123456791",
  // ...
};
```

Paste it into `config/emojiIds.js`, restart, done. Running `/emojis` without
`upload` just reports what is configured and what is missing.

**Manual** — Developer Portal → your application → **Emojis** → upload the 11
files (keep the file names), then paste each emoji's ID into
`config/emojiIds.js`.

Until an ID is filled in, that item falls back to its unicode glyph
(`config/items.js` → `emoji`) and the bot logs a startup warning naming
exactly what is still missing.

## Optional: selection corners

The reference marks the highlighted cell with corner brackets. The art is
already in the tileset (`misc/cursor.png` yellow, `misc/cursor_green.png`
green). They are not required: selection is already shown by the blue slot
button and by the details block.

If you want them anyway, upload `slot_<itemId>_sel` variants (composited as
`cursor + frame + item`) plus `slot_empty_sel`, then add those names to
`SLOT_EMOJI_IDS`. The bag looks them up automatically and falls back to the
plain emoji when they are absent.
