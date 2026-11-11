/**
 * Player market: list an item, buy someone else's listing.
 *
 * Prices are player-set (the sell button uses a suggested price). Gold moves
 * between profiles, so both sides are saved by the caller.
 */
import Listing from "../models/Listing.js";
import Profile from "../models/Profile.js";
import { getItemByKey, getItemMap, idOf } from "./itemCache.js";
import { addItem, countItem, removeItem } from "./inventory.js";

/** Suggested price for a stack: 90% of vendor value, rounded. */
export function suggestedPrice(key, quantity = 1) {
  const doc = getItemByKey(key);
  const base = doc?.value ?? 5;
  return Math.max(1, Math.round(base * quantity * 0.9));
}

/** How many listings the board shows at once. */
export const MARKET_PAGE_SIZE = 4;

/**
 * Lists `quantity` of `key` from the bag.
 *
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function listItem(player, key, quantity = 1, price = null) {
  const doc = getItemByKey(key);
  if (!doc) return { ok: false, message: "Unknown item." };

  if (countItem(player, key) < quantity) {
    return { ok: false, message: `You do not have ${doc.name} ×${quantity}.` };
  }

  const amount = Number.isFinite(price) && price > 0 ? Math.floor(price) : suggestedPrice(key, quantity);

  removeItem(player, key, quantity);
  await player.save();

  await Listing.create({
    sellerId: player.userId,
    sellerName: player.username,
    item: doc._id,
    itemKey: key,
    quantity,
    price: amount,
  });

  return {
    ok: true,
    message: `🏷️ Listed ${doc.name} ×${quantity} for ${amount} 🪙.`,
  };
}

/** Newest, cheapest listings first. */
export async function fetchListings(limit = MARKET_PAGE_SIZE) {
  return Listing.find({}).sort({ price: 1, createdAt: -1 }).limit(limit).lean();
}

/** Every listing by `userId` (used by the "my listings" count). */
export async function countListingsBy(userId) {
  return Listing.countDocuments({ sellerId: userId });
}

/** Cancels one of your own listings and returns the item to the bag. */
export async function cancelListing(player, listingId) {
  const listing = await Listing.findById(listingId);
  if (!listing) return { ok: false, message: "That listing is gone." };
  if (listing.sellerId !== player.userId) {
    return { ok: false, message: "That is not your listing." };
  }

  addItem(player, listing.itemKey, listing.quantity);
  await player.save();
  await Listing.deleteOne({ _id: listing._id });

  const doc = getItemByKey(listing.itemKey);
  return { ok: true, message: `↩️ Took back ${doc?.name ?? listing.itemKey} ×${listing.quantity}.` };
}

/**
 * Buys a listing: gold leaves the buyer, the stack enters their bag and the
 * seller is paid (the seller may be offline, so the payment is a direct
 * update rather than a document save).
 *
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function buyListing(player, listingId) {
  const listing = await Listing.findById(listingId);
  if (!listing) return { ok: false, message: "That listing is gone." };
  if (listing.sellerId === player.userId) {
    return { ok: false, message: "That is your own listing." };
  }
  if ((player.gold ?? 0) < listing.price) {
    return { ok: false, message: `You need ${listing.price} 🪙 for that.` };
  }

  const doc = getItemByKey(listing.itemKey);
  if (!doc) return { ok: false, message: "That item no longer exists." };

  // Claim the listing first so two buyers cannot both get it.
  const claimed = await Listing.findOneAndDelete({ _id: listing._id });
  if (!claimed) return { ok: false, message: "Someone else bought it first." };

  player.gold -= listing.price;
  addItem(player, listing.itemKey, listing.quantity);
  await player.save();

  await Profile.updateOne(
    { userId: listing.sellerId },
    { $inc: { gold: listing.price } },
  ).catch(() => {});

  return {
    ok: true,
    message: `🛒 Bought ${doc.name} ×${listing.quantity} for ${listing.price} 🪙.`,
  };
}

/** `{ key, name, quantity, price, sellerName, id }` rows for the screen. */
export async function marketRows(limit = MARKET_PAGE_SIZE) {
  const items = await getItemMap();
  const listings = await fetchListings(limit);

  return listings.map((listing) => ({
    id: String(listing._id),
    key: listing.itemKey,
    name: items.get(idOf(listing.item))?.name ?? getItemByKey(listing.itemKey)?.name ?? listing.itemKey,
    quantity: listing.quantity ?? 1,
    price: listing.price,
    sellerName: listing.sellerName,
  }));
}
