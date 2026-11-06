# Bag emojis — upload list

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

## After uploading

1. Developer Portal → your application → **Emojis** → upload all 11.
2. Right-click each emoji → **Copy Emoji ID**.
3. Paste the IDs into `config/emojiIds.js`:

```js
export const SLOT_EMOJI_IDS = {
  slot_empty: "1234567890123456789",
  slot_warrior_sword: "1234567890123456790",
  // ...
};
```

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
