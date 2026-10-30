import OfferSection from "../models/offerSection.js";
import Product from "../models/product.js";
import handleResponse from "../utils/helper.js";
import {
  parseCustomerCoordinates,
  getNearbySellerIdsForCustomer,
} from "../services/customerVisibilityService.js";
import { buildKey, getOrSet, getTTL, delPattern } from "../services/cacheService.js";
import { getApprovedOrLegacyFilter } from "../services/productModerationService.js";

const clearOfferSectionsCache = async () => {
  try {
    if (typeof delPattern === "function") {
      await delPattern("*offersections*");
    }
  } catch (err) {
    // Non-fatal cache invalidation error
  }
};

export const getPublicOfferSections = async (req, res) => {
  try {
    const coords = parseCustomerCoordinates(req.query || {});
    // Browsing without a location is allowed, same as the product catalogue:
    // a visitor who has not granted location sees every active section
    // unfiltered rather than none at all. Zone narrowing only kicks in once
    // we actually know where the customer is.
    const hasLocation = coords.valid;

    // Round coordinates to 3 decimals for cache bucket; no-location requests
    // share one bucket.
    const cacheKey = buildKey(
      "offersections",
      "public",
      hasLocation ? `${coords.lat.toFixed(3)}:${coords.lng.toFixed(3)}` : "no-location",
    );

    const filteredSections = await getOrSet(
      cacheKey,
      async () => {
        const nearbySellerIds = hasLocation
          ? await getNearbySellerIdsForCustomer(coords.lat, coords.lng)
          : null;
        const nearbySellerSet = nearbySellerIds
          ? new Set(nearbySellerIds.map(String))
          : null;

        const sections = await OfferSection.find({ status: "active" })
          .sort({ order: 1, createdAt: 1 })
          .populate("categoryIds", "name slug image")
          .populate("categoryId", "name slug image")
          .populate("sellerIds", "shopName name logo")
          .populate({
            path: "productIds",
            select: "name slug price salePrice mainImage stock unit sellerId status approvalStatus",
            match: {
              status: { $ne: "archived" },
            },
          })
          .populate({
            path: "productDetails.productId",
            select: "name slug price salePrice mainImage stock unit sellerId status approvalStatus",
            match: {
              status: { $ne: "archived" },
            },
          })
          .lean();

        const results = [];
        for (const section of sections) {
          // With no location, every configured seller/product for the
          // section is shown as-is — there is no "nearby" to narrow to yet.
          const sellerIds = Array.isArray(section.sellerIds)
            ? (nearbySellerSet
                ? section.sellerIds.filter((seller) => {
                    const sid = String(seller?._id || seller || "");
                    return sid && nearbySellerSet.has(sid);
                  })
                : section.sellerIds)
            : [];

          if (section.isAutomatic) {
            // For automatic sections, fetch top-selling products dynamically.
            // Without a location there is no seller radius to draw from, so
            // the section is skipped rather than querying every seller in
            // the system.
            if (!hasLocation) {
              results.push({ ...section, sellerIds, productIds: [] });
              continue;
            }
            const hasExplicitSellers = Array.isArray(section.sellerIds) && section.sellerIds.length > 0;
            const sellerFilter = sellerIds.length
              ? sellerIds.map((s) => s._id || s)
              : nearbySellerIds;
            const sellerCondition = hasExplicitSellers
              ? { sellerId: { $in: sellerFilter } }
              : {
                  $or: [
                    { sellerId: null },
                    { sellerId: { $in: sellerFilter } },
                  ],
                };

            const topProducts = await Product.find({
              ...sellerCondition,
              status: "active",
              ...getApprovedOrLegacyFilter(),
            })
              .sort({ salesCount: -1, createdAt: -1 })
              .limit(10)
              .select("name slug price salePrice mainImage stock unit sellerId status approvalStatus")
              .lean();

            results.push({
              ...section,
              sellerIds,
              productIds: topProducts,
            });
          } else {
            const offerPriceMap = new Map();
            if (Array.isArray(section.productDetails)) {
              section.productDetails.forEach((item) => {
                const pid = String(item?.productId?._id || item?.productId || "");
                if (pid && Number(item?.offerPrice) > 0) {
                  offerPriceMap.set(pid, Number(item.offerPrice));
                }
              });
            }

            // Collect all products from both productIds and productDetails.productId
            const detailProducts = Array.isArray(section.productDetails)
              ? section.productDetails.map((d) => d.productId).filter((p) => p && typeof p === "object")
              : [];
            const directProducts = Array.isArray(section.productIds)
              ? section.productIds.filter((p) => p && typeof p === "object")
              : [];

            const combinedMap = new Map();
            for (const p of [...directProducts, ...detailProducts]) {
              if (p?._id && !combinedMap.has(String(p._id))) {
                combinedMap.set(String(p._id), p);
              }
            }

            // All products selected by admin in manual offer sections are visible for all locations!
            const productIds = Array.from(combinedMap.values()).map((product) => {
              const op = offerPriceMap.get(String(product._id));
              return {
                ...product,
                offerPrice: op !== undefined && op > 0 ? op : (product.salePrice || product.price),
              };
            });

            results.push({
              ...section,
              sellerIds: section.sellerIds || [],
              productIds,
            });
          }
        }
        return results;
      },
      15, // Short 15s TTL so offer section updates appear immediately
    );

    return handleResponse(res, 200, "Offer sections fetched", filteredSections);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getAdminOfferSections = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status && ["active", "inactive"].includes(status)) query.status = status;

    const sections = await OfferSection.find(query)
      .sort({ order: 1, createdAt: 1 })
      .populate("categoryIds", "name")
      .populate("categoryId", "name")
      .populate("sellerIds", "shopName name")
      .populate({
        path: "productDetails.productId",
        select: "name slug price salePrice mainImage stock unit sellerId status",
      })
      .populate({
        path: "productIds",
        select: "name slug price salePrice mainImage stock unit sellerId status",
      })
      .lean();

    return handleResponse(res, 200, "Offer sections fetched", sections);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const createOfferSection = async (req, res) => {
  try {
    const {
      title,
      backgroundColor,
      sideImageKey,
      categoryIds = [],
      sellerIds = [],
      productIds = [],
      productDetails = [],
      order,
      status,
      isAutomatic = false,
    } = req.body;

    if (!title || !title.trim()) {
      return handleResponse(res, 400, "Title is required");
    }

    let normalizedProductDetails = [];
    let finalProductIds = [];

    if (Array.isArray(productDetails) && productDetails.length > 0) {
      normalizedProductDetails = productDetails
        .filter((item) => Boolean(item?.productId || item?._id || item?.id))
        .map((item) => ({
          productId: item.productId || item._id || item.id,
          offerPrice: Math.max(0, Number(item.offerPrice) || 0),
        }));
      finalProductIds = normalizedProductDetails.map((item) => item.productId);
    } else if (Array.isArray(productIds) && productIds.length > 0) {
      finalProductIds = productIds.filter(Boolean);
      normalizedProductDetails = finalProductIds.map((pid) => ({
        productId: pid,
        offerPrice: 0,
      }));
    }

    const catIds = Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : [];
    if (!isAutomatic && !catIds.length && !finalProductIds.length) {
      return handleResponse(res, 400, "Please select at least one category or product");
    }

    const count = await OfferSection.countDocuments({});
    const isAuto = finalProductIds.length > 0 || normalizedProductDetails.length > 0
      ? false
      : Boolean(isAutomatic);

    const section = await OfferSection.create({
      title: title.trim(),
      backgroundColor: backgroundColor || "#FCD34D",
      sideImageKey: sideImageKey || "hair-care",
      categoryIds: isAuto ? [] : catIds,
      sellerIds: Array.isArray(sellerIds) ? sellerIds.filter(Boolean) : [],
      productIds: isAuto ? [] : finalProductIds,
      productDetails: isAuto ? [] : (normalizedProductDetails.length > 0
        ? normalizedProductDetails
        : finalProductIds.map((pid) => ({ productId: pid, offerPrice: 0 }))),
      order: typeof order === "number" ? order : count,
      status: status || "active",
      isAutomatic: isAuto,
    });

    // If offer prices were set, update Product salePrice accordingly
    if (!isAuto && normalizedProductDetails.length > 0) {
      for (const item of normalizedProductDetails) {
        if (item.offerPrice > 0) {
          try {
            const prod = await Product.findById(item.productId).select("price salePrice");
            if (prod && item.offerPrice <= prod.price) {
              prod.salePrice = item.offerPrice;
              await prod.save();
            }
          } catch (e) {
            // Ignore non-fatal individual product update errors
          }
        }
      }
    }

    await clearOfferSectionsCache();
    return handleResponse(res, 201, "Offer section created", section);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

export const updateOfferSection = async (req, res) => {
  try {
    const { id } = req.params;
    const section = await OfferSection.findById(id);
    if (!section) return handleResponse(res, 404, "Offer section not found");

    const payload = req.body || {};
    if (payload.title !== undefined) section.title = payload.title.trim();
    if (payload.backgroundColor !== undefined)
      section.backgroundColor = payload.backgroundColor;
    if (payload.sideImageKey !== undefined)
      section.sideImageKey = payload.sideImageKey;

    let normalizedProductDetails = [];
    const isAuto = payload.isAutomatic !== undefined ? Boolean(payload.isAutomatic) : section.isAutomatic;
    section.isAutomatic = isAuto;

    if (isAuto) {
      // Clear categories and products for automatic sections
      section.categoryIds = [];
      section.productIds = [];
      section.productDetails = [];
    } else {
      if (Array.isArray(payload.productDetails)) {
        normalizedProductDetails = payload.productDetails
          .filter((item) => Boolean(item?.productId || item?._id || item?.id))
          .map((item) => ({
            productId: item.productId || item._id || item.id,
            offerPrice: Math.max(0, Number(item.offerPrice) || 0),
          }));
        section.productDetails = normalizedProductDetails;
        section.productIds = normalizedProductDetails.map((item) => item.productId);
      } else if (Array.isArray(payload.productIds)) {
        section.productIds = payload.productIds.filter(Boolean);
        section.productDetails = section.productIds.map((pid) => ({
          productId: pid,
          offerPrice: 0,
        }));
      }

      if (Array.isArray(payload.categoryIds))
        section.categoryIds = payload.categoryIds.filter(Boolean);
    }

    if (Array.isArray(payload.sellerIds))
      section.sellerIds = payload.sellerIds.filter(Boolean);
    if (payload.order !== undefined) section.order = payload.order;
    if (payload.status !== undefined) section.status = payload.status;

    await section.save();

    // If offer prices were set, update Product salePrice accordingly
    if (!section.isAutomatic && normalizedProductDetails.length > 0) {
      for (const item of normalizedProductDetails) {
        if (item.offerPrice > 0) {
          try {
            const prod = await Product.findById(item.productId).select("price salePrice");
            if (prod && item.offerPrice <= prod.price) {
              prod.salePrice = item.offerPrice;
              await prod.save();
            }
          } catch (e) {
            // Ignore non-fatal individual product update errors
          }
        }
      }
    }

    await clearOfferSectionsCache();
    return handleResponse(res, 200, "Offer section updated", section);
  } catch (error) {
    return handleResponse(res, 400, error.message);
  }
};

export const deleteOfferSection = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await OfferSection.findByIdAndDelete(id);
    if (!deleted) return handleResponse(res, 404, "Offer section not found");
    await clearOfferSectionsCache();
    return handleResponse(res, 200, "Offer section deleted");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const reorderOfferSections = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return handleResponse(res, 200, "No sections to reorder");
    }
    const bulkOps = items
      .filter((it) => it && it.id)
      .map((it) => ({
        updateOne: {
          filter: { _id: it.id },
          update: { $set: { order: it.order } },
        },
      }));
    if (bulkOps.length) await OfferSection.bulkWrite(bulkOps);
    await clearOfferSectionsCache();
    return handleResponse(res, 200, "Sections reordered");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
