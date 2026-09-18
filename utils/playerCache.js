import Profile from "../models/Profile.js";

const cache = new Map();
const CACHE_DURATION_MS = 15 * 1000;

/**
 * @param {string} userId The user's Discord ID.
 * @returns {Promise<object|null>} The Mongoose document for the profile.
 */
export async function getCachedProfile(userId) {
  if (cache.has(userId)) {
    return cache.get(userId);
  }

  const playerProfile = await Profile.findOne({ userId })
    .populate("equipped.weapon")
    .populate("equipped.armor")
    .populate("equipped.accessory")
    .populate("inventory.item");

  if (playerProfile) {
    cache.set(userId, playerProfile);

    setTimeout(() => {
      cache.delete(userId);
    }, CACHE_DURATION_MS);
  }

  return playerProfile;
}

/**
 * Immediately removes a profile from the cache.
 * @param {string} userId
 */
export function invalidateCache(userId) {
  cache.delete(userId);
}
