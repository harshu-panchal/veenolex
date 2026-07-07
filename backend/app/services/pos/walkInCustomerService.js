/**
 * walkInCustomerService.js — Walk-in customer handling for POS.
 *
 * When customerId === "walk-in-customer", auto-creates or finds the
 * standard walk-in customer record. This avoids requiring customer
 * selection for quick cash sales.
 */

import User from "../../models/customer.js";

const WALK_IN_PHONE = "0000000000";
const WALK_IN_EMAIL = "walkin@pos.com";
const WALK_IN_NAME = "Walk-in Customer";

/**
 * Get or create the walk-in customer.
 * Returns the User document for the walk-in customer.
 *
 * @param {Object} options
 * @param {Object} options.session - Mongoose session (optional)
 * @returns {Promise<Object>} User document
 */
export async function getOrCreateWalkInCustomer({ session = null } = {}) {
  const opts = session ? { session } : {};

  // Try to find existing walk-in customer by phone or email to prevent duplicates
  let walkIn = await User.findOne({
    $or: [
      { phone: WALK_IN_PHONE },
      { email: WALK_IN_EMAIL }
    ]
  }).session(session || null);

  if (!walkIn) {
    // Create walk-in customer
    const [created] = await User.create(
      [
        {
          name: WALK_IN_NAME,
          phone: WALK_IN_PHONE,
          email: WALK_IN_EMAIL,
          role: "user",
          isVerified: true,
          isActive: true,
          sellerId: null,  // Admin-scoped
        },
      ],
      opts
    );
    walkIn = created;
  }

  return walkIn;
}

/**
 * Check if a customer ID represents a walk-in customer.
 *
 * @param {string} customerId
 * @returns {boolean}
 */
export function isWalkInCustomer(customerId) {
  return customerId === "walk-in-customer";
}

/**
 * Resolve customer for POS order creation.
 * Handles both walk-in and regular customer IDs.
 *
 * @param {string} customerId - "walk-in-customer" or a valid User ObjectId
 * @param {Object} options
 * @param {Object} options.session - Mongoose session
 * @returns {Promise<Object>} User document
 */
export async function resolvePOSCustomer(customerId, { session = null } = {}) {
  if (isWalkInCustomer(customerId)) {
    return getOrCreateWalkInCustomer({ session });
  }

  const customer = await User.findById(customerId).session(session || null);
  if (!customer) {
    throw new Error("Customer not found");
  }

  return customer;
}
