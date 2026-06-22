import MarketingPopup from "../models/marketingPopup.js";
import { handleResponse } from "../utils/helper.js";
import getPagination from "../utils/pagination.js";
import { uploadToCloudinary } from "../services/mediaService.js";

// Public: Get active popup
export const getActivePopup = async (req, res) => {
  try {
    const now = new Date();
    const query = {
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: null },
            { startDate: { $exists: false } },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: null },
            { endDate: { $exists: false } },
            { endDate: { $gte: now } },
          ],
        },
      ],
    };

    const activePopup = await MarketingPopup.findOne(query)
      .sort({ updatedAt: -1 })
      .lean();

    return handleResponse(
      res,
      200,
      activePopup ? "Active popup fetched successfully" : "No active popup found",
      activePopup || null
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: List all popups
export const getPopups = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req, { defaultLimit: 25, maxLimit: 200 });

    const [popups, total] = await Promise.all([
      MarketingPopup.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      MarketingPopup.countDocuments(),
    ]);

    return handleResponse(res, 200, "Popups fetched successfully", {
      items: popups,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Create popup
export const createPopup = async (req, res) => {
  try {
    const {
      title,
      description,
      imageUrl,
      linkType,
      linkValue,
      isActive,
      showOnce,
      startDate,
      endDate,
    } = req.body;

    if (!title || !imageUrl) {
      return handleResponse(res, 400, "Title and Image URL are required");
    }

    const popup = new MarketingPopup({
      title,
      description,
      imageUrl,
      linkType,
      linkValue,
      isActive: isActive ?? true,
      showOnce: showOnce ?? true,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    await popup.save();

    return handleResponse(res, 201, "Popup created successfully", popup);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Update popup
export const updatePopup = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      imageUrl,
      linkType,
      linkValue,
      isActive,
      showOnce,
      startDate,
      endDate,
    } = req.body;

    const popup = await MarketingPopup.findById(id);
    if (!popup) {
      return handleResponse(res, 404, "Popup not found");
    }

    if (title !== undefined) popup.title = title;
    if (description !== undefined) popup.description = description;
    if (imageUrl !== undefined) popup.imageUrl = imageUrl;
    if (linkType !== undefined) popup.linkType = linkType;
    if (linkValue !== undefined) popup.linkValue = linkValue;
    if (isActive !== undefined) popup.isActive = isActive;
    if (showOnce !== undefined) popup.showOnce = showOnce;
    
    // Explicitly allow setting start/end dates to null or empty
    if (startDate !== undefined) popup.startDate = startDate || null;
    if (endDate !== undefined) popup.endDate = endDate || null;

    await popup.save();

    return handleResponse(res, 200, "Popup updated successfully", popup);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Delete popup
export const deletePopup = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPopup = await MarketingPopup.findByIdAndDelete(id);
    if (!deletedPopup) {
      return handleResponse(res, 404, "Popup not found");
    }

    return handleResponse(res, 200, "Popup deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

// Admin: Upload popup image
export const uploadPopupImage = async (req, res) => {
  try {
    if (req.file) {
      const uploadedUrl = await uploadToCloudinary(req.file.buffer, "popups", {
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
