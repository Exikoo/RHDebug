# Emojis to upload

49 names, and **every one of them now has art on disk** — `npm run build:emojis`
rebuilds the 21 tileset-derived ones, so `/emojis upload` has nothing to skip.

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

All thirteen come out of `npm run build:emojis` as well (tileset art, or drawn
in the same palette when the set has nothing usable).

| # | Emoji name | Used for | Built from / art |
| --- | --- | --- | --- |
| 29 | `prof_mining` | Mining line + gather button | `item/misc/misc_tremorstones.png` |
| 30 | `prof_woodcutting` | Woodcutting | `item/weapon/battle_axe1.png` |
| 31 | `prof_fishing` | Fishing | `item/rod/rod00.png` |
| 32 | `prof_herbalism` | Herbalism | `dngn/decor/flower_patch_0.png` |
| 33 | `prof_smithing` | Smithing bench + professions map button | drawn: hammer |
| 34 | `prof_crafting` | Crafting bench | `item/book/cloth.png` |
| 35 | `prof_cooking` | Cooking bench | `item/food/bread_ration.png` |
| 36 | `ui_quests` | map row → quest board | `item/parchment/base_parchment_low_level.png` |
| 37 | `ui_market` | map row → player market | `dngn/shops/shop_general.png` |
| 38 | `ui_trophy` | achievements | drawn: gold cup |
| 39 | `ui_ranks` | rankings | drawn: podium |
| 40 | `ui_gold` | the gold counter | `item/gold/01.png` |

Three of them are drawn because the DCSS tileset has no pickaxe, no hammer and
no trophy: they use the same pixel grid and palette as the rest (dark frame,
gold/brown/grey fills) so they sit next to tileset art without standing out.

Until an ID is pasted into `config/emojiIds.js` every one of them falls back to
a unicode glyph, so the screens work either way.

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

## Troubleshooting `/emojis`

| What you see | What it means | Fix |
| --- | --- | --- |
| `/emojis` is not in the command list | The slash commands have not propagated yet, or you are not an administrator | Set `GUILD_ID` in `.env` to your test server and restart: guild commands appear instantly (global ones can take an hour). The command is administrator-only by design. |
| `❌ /emojis failed: ...` | The command threw; the message carries Discord's reason | Run it again — uploads that already went through are skipped. |
| `⚠️ Failed N: name (Missing Access [50001])` | The application-emoji API refused the upload for this app | The command automatically retries as a **guild** emoji; give the bot **Manage Expressions** in that server so the retry can work. Guild emojis work in the screens, but only in that server. |
| `(no PNG in docs/emojis)` | The emoji is configured but has no art | `npm run build:emojis` rebuilds the tileset-derived ones; the rest are listed earlier in this file. |
| Reply lists `N application, 0 guild` | All good — uploads went to the application, so every server can use them | Paste the printed block into `config/emojiIds.js`. |

The command prints the whole state every run: how many of the 49 names exist, how
many are pasted into the config, how many PNGs are on disk, and a ready-to-paste
block (attached as a file when it is too long for one message).

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
