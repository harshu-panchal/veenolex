import Cart from "../models/cart.js";
import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";
import { getApprovedOrLegacyFilter } from "../services/productModerationService.js";

const CART_POPULATE_FIELDS =
  "name slug price salePrice mainImage stock status headerId categoryId subcategoryId sellerId variants zoneOutDeliveryEnabled zoneOutPrice";

const CUSTOMER_VISIBLE_PRODUCT_MATCH = {
  status: "active",
  ...getApprovedOrLegacyFilter(),
};

function sanitizeCartItems(cart) {
  if (!cart || !Array.isArray(cart.items)) return cart;
  const validItems = cart.items.filter((item) => Boolean(item?.productId));
  const seen = new Map();
  const deduped = [];

  for (const item of validItems) {
    const prodId = String(item.productId?._id || item.productId || "");
    const variant = String(item.variantSku || "").trim().toLowerCase();
    const key = `${prodId}::${variant}`;

    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.quantity = Math.max(existing.quantity || 1, item.quantity || 1);
    } else {
      const copy = typeof item.toObject === "function" ? item.toObject() : { ...item };
      seen.set(key, copy);
      deduped.push(copy);
    }
  }

  cart.items = deduped;
  return cart;
}

async function getCustomerVisibleProductById(productId) {
  if (!productId) return null;
  return Product.findOne({
    _id: productId,
    ...CUSTOMER_VISIBLE_PRODUCT_MATCH,
  })
    .select("_id")
    .lean();
}

async function fetchPopulatedCart(cartId) {
  const cart = await Cart.findById(cartId)
    .populate({
      path: "items.productId",
      select: CART_POPULATE_FIELDS,
      match: CUSTOMER_VISIBLE_PRODUCT_MATCH,
    })
    .lean();

  return sanitizeCartItems(cart);
}

/* ===============================
   GET CUSTOMER CART
================================ */
export const getCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId })
      .populate({
        path: "items.productId",
        select: CART_POPULATE_FIELDS,
        match: CUSTOMER_VISIBLE_PRODUCT_MATCH,
      })
      .lean();

    if (!cart) {
      const newCart = await Cart.create({ customerId, items: [] });
      return handleResponse(res, 200, "Cart fetched successfully", newCart);
    }

    return handleResponse(res, 200, "Cart fetched successfully", sanitizeCartItems(cart));
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   ADD TO CART
================================ */
export const addToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity = 1, variantSku = "" } = req.body;
    const normalizedVariantSku = String(variantSku || "").trim();
    const customerVisibleProduct = await getCustomerVisibleProductById(productId);
    if (!customerVisibleProduct) {
      return handleResponse(res, 404, "Product is not available for purchase");
    }

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      cart = new Cart({ customerId, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId &&
        item.productId.toString() === productId &&
        String(item.variantSku || "").trim() === normalizedVariantSku,
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, variantSku: normalizedVariantSku, quantity });
    }

    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Item added to cart", updatedCart);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   MERGE CART (GUEST TO USER)
================================ */
export const mergeCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return getCart(req, res);
    }

    let cart = await Cart.findOne({ customerId });
    if (!cart) {
      cart = new Cart({ customerId, items: [] });
    }

    // 1. Build an item map of existing lines to eliminate any prior duplicate rows
    const itemMap = new Map();
    for (const existing of cart.items) {
      if (!existing?.productId) continue;
      const pid = String(existing.productId);
      const vSku = String(existing.variantSku || "").trim();
      const key = `${pid}::${vSku.toLowerCase()}`;

      if (itemMap.has(key)) {
        const item = itemMap.get(key);
        item.quantity = Math.max(item.quantity, Number(existing.quantity) || 1);
      } else {
        itemMap.set(key, {
          productId: existing.productId,
          variantSku: vSku,
          quantity: Math.max(1, Number(existing.quantity) || 1),
        });
      }
    }

    // 2. Merge incoming guest items into the map
    for (const item of items) {
      const productId = item.productId || item.id || item._id;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const normalizedVariantSku = String(item.variantSku || "").trim();

      const customerVisibleProduct = await getCustomerVisibleProductById(productId);
      if (!customerVisibleProduct) continue;

      const pid = String(productId);
      const exactKey = `${pid}::${normalizedVariantSku.toLowerCase()}`;
      const baseKey = `${pid}::`;

      // Match exact key, or reconcile if existing had base variant vs specific variant
      let targetKey = exactKey;
      if (!itemMap.has(exactKey) && !normalizedVariantSku && itemMap.has(baseKey)) {
        targetKey = baseKey;
      } else if (!itemMap.has(exactKey) && normalizedVariantSku && itemMap.has(baseKey)) {
        const existingBase = itemMap.get(baseKey);
        itemMap.delete(baseKey);
        existingBase.variantSku = normalizedVariantSku;
        itemMap.set(exactKey, existingBase);
        targetKey = exactKey;
      }

      if (itemMap.has(targetKey)) {
        const existing = itemMap.get(targetKey);
        // Use user's latest intended quantity (do not double with +=)
        existing.quantity = Math.max(existing.quantity, quantity);
        if (normalizedVariantSku && !existing.variantSku) {
          existing.variantSku = normalizedVariantSku;
        }
      } else {
        itemMap.set(exactKey, {
          productId,
          variantSku: normalizedVariantSku,
          quantity,
        });
      }
    }

    // 3. Update cart.items with the clean deduplicated array
    cart.items = Array.from(itemMap.values());
    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Cart merged successfully", updatedCart);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE QUANTITY
================================ */
export const updateQuantity = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity, variantSku = "" } = req.body;
    const normalizedVariantSku = String(variantSku || "").trim();

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId &&
        item.productId.toString() === productId &&
        String(item.variantSku || "").trim() === normalizedVariantSku,
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      if (cart.items[itemIndex].quantity <= 0) {
        cart.items.splice(itemIndex, 1);
      }
    } else {
      return handleResponse(res, 404, "Product not in cart");
    }

    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Cart updated successfully", updatedCart);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REMOVE FROM CART
================================ */
export const removeFromCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId } = req.params;
    const normalizedVariantSku = String(req.query?.variantSku || "").trim();

    let cart = await Cart.findOne({ customerId });

    if (!cart) {
      return handleResponse(res, 404, "Cart not found");
    }

    cart.items = cart.items.filter((item) => {
      if (!item.productId) return false;
      if (item.productId.toString() !== productId) return true;
      // If variantSku is provided, remove only that variant line.
      if (normalizedVariantSku) {
        return String(item.variantSku || "").trim() !== normalizedVariantSku;
      }
      // If no variantSku is provided, keep legacy behavior: remove all lines for that product.
      return false;
    });

    await cart.save();
    const updatedCart = await fetchPopulatedCart(cart._id);

    return handleResponse(res, 200, "Item removed from cart", updatedCart);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   CLEAR CART
================================ */
export const clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return handleResponse(res, 200, "Cart cleared successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
