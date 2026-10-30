import CheckoutRecommendation from "../models/checkoutRecommendation.js";
import { handleResponse } from "../utils/helper.js";
import getPagination from "../utils/pagination.js";

// Public: Get active checkout recommended products
export const getPublicCheckoutRecommendations = async (req, res) => {
  try {
    const list = await CheckoutRecommendation.find({ status: "active" })
      .sort({ order: 1, createdAt: 1 })
      .populate("product")
      .lean();

    const products = list
      .filter((item) => item.product && item.product.status === "active")
      .map((item) => {
        const p = item.product;
        return {
          ...p,
          id: p._id,
          originalPrice: p.price,
          price: p.salePrice || p.price,
          weight: p.weight || "1 unit",
          deliveryTime: "8-15 mins",
          checkoutRecommendationId: item._id,
          recommendationOrder: item.order,
        };
      });

    return handleResponse(res, 200, "Checkout recommendations fetched successfully", products);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Get all recommendation mappings
export const getAdminCheckoutRecommendations = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [items, total] = await Promise.all([
      CheckoutRecommendation.find()
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("product")
        .lean(),
      CheckoutRecommendation.countDocuments(),
    ]);

    return handleResponse(res, 200, "Admin checkout recommendations fetched successfully", {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Add product to checkout recommendations
export const createCheckoutRecommendation = async (req, res) => {
  try {
    const { productId, order, status } = req.body;

    if (!productId) {
      return handleResponse(res, 400, "Product ID is required");
    }

    const existing = await CheckoutRecommendation.findOne({ product: productId });
    if (existing) {
      return handleResponse(res, 400, "This product is already added to checkout recommendations");
    }

    const mapping = new CheckoutRecommendation({
      product: productId,
      order: order !== undefined ? Number(order) : 0,
      status: status || "active",
    });

    await mapping.save();

    const populated = await CheckoutRecommendation.findById(mapping._id).populate("product");

    return handleResponse(res, 201, "Product added to checkout recommendations successfully", populated);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Update recommendation
export const updateCheckoutRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const { order, status } = req.body;

    const mapping = await CheckoutRecommendation.findById(id);
    if (!mapping) {
      return handleResponse(res, 404, "Checkout recommendation entry not found");
    }

    if (order !== undefined) mapping.order = Number(order);
    if (status) mapping.status = status;

    await mapping.save();

    const populated = await CheckoutRecommendation.findById(mapping._id).populate("product");

    return handleResponse(res, 200, "Checkout recommendation updated successfully", populated);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Delete recommendation
export const deleteCheckoutRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CheckoutRecommendation.findByIdAndDelete(id);
    if (!deleted) {
      return handleResponse(res, 404, "Checkout recommendation entry not found");
    }

    return handleResponse(res, 200, "Removed from checkout recommendations successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

