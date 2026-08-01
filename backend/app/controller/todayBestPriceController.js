import TodayBestPrice from "../models/todayBestPrice.js";
import { handleResponse } from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { uploadToCloudinary } from "../services/mediaService.js";

// Public: Get Today's Best Prices active products list
export const getTodayBestPrices = async (req, res) => {
  try {
    const list = await TodayBestPrice.find({ status: "active" })
      .sort({ order: 1, createdAt: 1 })
      .populate("product")
      .lean();

    // Map and override mainImage with customImage if available
    const products = list
      .filter((item) => item.product && item.product.status === "active")
      .map((item) => {
        const p = item.product;
        // Map standard frontend expected structure
        const formatted = {
          ...p,
          id: p._id,
          originalPrice: p.price,
          price: p.salePrice || p.price,
          weight: p.weight || "1 unit",
          deliveryTime: "8-15 mins",
        };
        if (item.customImage) {
          formatted.image = item.customImage;
          formatted.mainImage = item.customImage;
        } else {
          formatted.image = p.mainImage || p.image;
        }
        // Also keep track of the mapping ID
        formatted.todayPriceMappingId = item._id;
        formatted.todayPriceOrder = item.order;
        formatted.todayPriceCustomImage = item.customImage;
        return formatted;
      });

    return handleResponse(res, 200, "Today's best prices fetched successfully", products);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Get all mappings (paginated)
export const getTodayBestPricesAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, { defaultLimit: 50, maxLimit: 200 });

    const [items, total] = await Promise.all([
      TodayBestPrice.find()
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("product")
        .lean(),
      TodayBestPrice.countDocuments(),
    ]);

    return handleResponse(res, 200, "Admin Today's Best Prices fetched successfully", {
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

// Admin: Create Today's Best Price mapping
export const createTodayBestPrice = async (req, res) => {
  try {
    const { productId, customImage, order, status } = req.body;

    if (!productId) {
      return handleResponse(res, 400, "Product ID is required");
    }

    // Check if product is already in the list
    const existing = await TodayBestPrice.findOne({ product: productId });
    if (existing) {
      return handleResponse(res, 400, "This product is already added to Today's Best Prices");
    }

    const mapping = new TodayBestPrice({
      product: productId,
      customImage: customImage || "",
      order: order !== undefined ? Number(order) : 0,
      status: status || "active",
    });

    await mapping.save();
    
    const populated = await TodayBestPrice.findById(mapping._id).populate("product");

    return handleResponse(res, 201, "Product added to Today's Best Prices successfully", populated);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Update Today's Best Price mapping
export const updateTodayBestPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { customImage, order, status } = req.body;

    const mapping = await TodayBestPrice.findById(id);
    if (!mapping) {
      return handleResponse(res, 404, "Mapping not found");
    }

    if (customImage !== undefined) mapping.customImage = customImage;
    if (order !== undefined) mapping.order = Number(order);
    if (status !== undefined) mapping.status = status;

    await mapping.save();
    
    const populated = await TodayBestPrice.findById(mapping._id).populate("product");

    return handleResponse(res, 200, "Mapping updated successfully", populated);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Delete Today's Best Price mapping
export const deleteTodayBestPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await TodayBestPrice.findByIdAndDelete(id);
    if (!deleted) {
      return handleResponse(res, 404, "Mapping not found");
    }
    return handleResponse(res, 200, "Mapping deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Upload custom image
export const uploadTodayBestPriceImage = async (req, res) => {
  try {
    if (req.file) {
      const uploadedUrl = await uploadToCloudinary(req.file.buffer, "marketing", {
        mimeType: req.file.mimetype,
        resourceType: "image",
      });
      return handleResponse(res, 200, "Image uploaded successfully", { url: uploadedUrl });
    }

    const providedUrl = String(req.body?.url || req.body?.imageUrl || "").trim();
    if (!providedUrl || !/^https?:\/\//i.test(providedUrl)) {
      return handleResponse(res, 400, "A valid image URL is required");
    }
    return handleResponse(res, 200, "Image URL accepted", { url: providedUrl });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
