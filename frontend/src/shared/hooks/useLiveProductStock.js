import { useEffect, useRef } from "react";
import { useAuth } from "@core/context/AuthContext";
import { onProductStock } from "@core/services/orderSocket";

/**
 * Sellable stock for one POS row from a live `product:stock` update:
 * min(product stock, variant stock), or the product stock when the row has
 * no real variant. Returns null when the update doesn't cover this row.
 */
export function liveStockFor(updates = [], productId, variantId) {
  const update = updates.find((u) => String(u.productId) === String(productId));
  if (!update) return null;
  const variant = variantId
    ? (update.variants || []).find((v) => String(v._id) === String(variantId))
    : null;
  return variant ? Math.min(update.stock, variant.stock) : update.stock;
}

/**
 * Product-list row (`{ _id, stock, variants }`) with live stock applied;
 * the same object when the updates don't touch it.
 */
export function patchProductStock(product, updates = []) {
  const update = updates.find((u) => String(u.productId) === String(product?._id));
  if (!update) return product;
  const variantStock = new Map((update.variants || []).map((v) => [String(v._id), v.stock]));
  return {
    ...product,
    stock: update.stock,
    variants: Array.isArray(product.variants)
      ? product.variants.map((v) =>
          variantStock.has(String(v._id)) ? { ...v, stock: variantStock.get(String(v._id)) } : v
        )
      : product.variants,
  };
}

/**
 * Calls `onUpdates(updates)` whenever stock changes on the server, and
 * `onRefocus()` when the tab becomes visible again (catch-up after the
 * socket was asleep).
 */
export function useLiveProductStock(onUpdates, onRefocus) {
  const { token } = useAuth();
  const handlers = useRef({ onUpdates, onRefocus });
  useEffect(() => {
    handlers.current = { onUpdates, onRefocus };
  });

  useEffect(() => {
    if (!token) return undefined;
    const off = onProductStock(
      () => token,
      (payload) => {
        const updates = payload?.updates || [];
        if (updates.length) handlers.current.onUpdates?.(updates);
      },
    );
    return off;
  }, [token]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") handlers.current.onRefocus?.();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
