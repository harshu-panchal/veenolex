/**
 * adminPosBillSettings.js — Manage bill settings for Admin POS receipts.
 *
 * Saves and loads bill settings (headers, footers, shop info) to/from localStorage.
 */

const STORAGE_KEY = "admin_pos_bill_settings";

const DEFAULT_SETTINGS = {
  shopName:  { text: "Veenolex Herbs & Spices", enabled: true },
  address:   { text: "123, Organic Market Lane, Sector 5", enabled: true },
  phone:     { text: "+91 98765 43210", enabled: true },
  notes:     { text: "Thank you for shopping with us! Visit again.", enabled: true },
  terms:     { text: "Goods once sold cannot be returned or exchanged.", enabled: true },
  gst:       { text: "27AAAAA1111A1Z1", enabled: false },
  fssai:     { text: "12345678901234", enabled: false },
};

/**
 * Load admin bill settings from local storage.
 *
 * @returns {Object} Admin bill settings object
 */
export function getAdminPOSBillSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save admin bill settings to local storage.
 *
 * @param {Object} settings
 */
export function saveAdminPOSBillSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save admin POS settings to localStorage", error);
  }
}
