/**
 * sellerPosBillSettings.js — Cache manager for seller bill settings.
 *
 * Provides temporary cache access to seller bill settings between fetches.
 */

let sellerBillSettingsCache = null;

export function getSellerPOSBillSettingsCache() {
  return sellerBillSettingsCache;
}

export function setSellerPOSBillSettingsCache(settings) {
  sellerBillSettingsCache = settings;
}

export function clearSellerPOSBillSettingsCache() {
  sellerBillSettingsCache = null;
}
