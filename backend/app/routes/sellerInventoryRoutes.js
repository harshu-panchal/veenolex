import express from "express";
import {
  verifyToken,
  allowRoles
} from "../middleware/authMiddleware.js";
import SellerInventory from
  "../models/sellerInventory.js";
import Product from "../models/product.js";

const router = express.Router();

// ═══════════════════════════════════════════════
// GET /api/seller-inventory/my-products
// Seller fetches their inventory
// Merges seller data with latest admin product data
// ═══════════════════════════════════════════════
router.get(
  "/my-products",
  verifyToken,
  allowRoles("seller"),
  async (req, res) => {
    try {
      const sellerId = req.user.id;
      const { status } = req.query;

      console.log("📦 Fetching inventory:", sellerId);

      // Build query
      const query = { sellerId };
      if (status && status !== "ALL") {
        query.status = status;
      }

      // Fetch seller inventory
      const inventory = await SellerInventory
        .find(query)
        .sort({ approvedAt: -1 })
        .lean();

      // Merge with LATEST admin product data
      // (Name, image, category always from admin)
      const enrichedInventory = await Promise.all(
        inventory.map(async (item) => {
          try {
            const adminProduct = await Product
              .findById(item.productId)
              .lean();

            if (adminProduct) {
              return {
                ...item,
                // Override with latest admin data
                productName: adminProduct.name ||
                  item.productName,
                productImage:
                  adminProduct.images?.[0] ||
                  item.productImage,
                category: adminProduct.category ||
                  item.category,
                subCategory: adminProduct.subCategory ||
                  item.subCategory,
                description: adminProduct.description ||
                  item.description,
                originalPrice: adminProduct.price ||
                  item.originalPrice,
                // Keep seller's own price
                sellerPrice: item.sellerPrice,
                // Keep seller's own stock
                availableStock: item.availableStock,
                totalStock: item.totalStock,
                soldStock: item.soldStock
              };
            }
            return item;
          } catch (err) {
            console.error(
              "❌ Error enriching product:",
              item.productName
            );
            return item;
          }
        })
      );

      // Calculate stats
      const stats = {
        totalProducts: enrichedInventory.length,
        totalStock: enrichedInventory.reduce(
          (sum, i) => sum + (i.availableStock || 0), 0
        ),
        activeProducts: enrichedInventory.filter(
          (i) => i.status === "ACTIVE"
        ).length,
        outOfStock: enrichedInventory.filter(
          (i) => i.status === "OUT_OF_STOCK"
        ).length,
        totalValue: enrichedInventory.reduce(
          (sum, i) =>
            sum + (i.sellerPrice * i.availableStock || 0),
          0
        )
      };

      console.log(
        "✅ Inventory fetched:",
        enrichedInventory.length
      );

      return res.status(200).json({
        success: true,
        count: enrichedInventory.length,
        stats: stats,
        data: enrichedInventory
      });

    } catch (error) {
      console.error("❌ Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch inventory"
      });
    }
  }
);

// ═══════════════════════════════════════════════
// PATCH /api/seller-inventory/:inventoryId/price
// ✅ ONLY ALLOWED EDIT: Update selling price
// ═══════════════════════════════════════════════
router.patch(
  "/:inventoryId/price",
  verifyToken,
  allowRoles("seller"),
  async (req, res) => {
    try {
      const { inventoryId } = req.params;
      const { sellerPrice } = req.body;
      const sellerId = req.user.id;

      console.log(
        "💰 Updating price for:",
        inventoryId,
        "New price:",
        sellerPrice
      );

      // ─────────────────────────────────
      // VALIDATE: ONLY price is accepted
      // ─────────────────────────────────
      if (sellerPrice === undefined || sellerPrice === null) {
        return res.status(400).json({
          success: false,
          message: "sellerPrice is required"
        });
      }

      if (typeof sellerPrice !== "number" || sellerPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "sellerPrice must be a positive number"
        });
      }

      if (sellerPrice === 0) {
        return res.status(400).json({
          success: false,
          message: "sellerPrice cannot be zero"
        });
      }

      // ─────────────────────────────────
      // FIND INVENTORY ITEM
      // (Must belong to this seller)
      // ─────────────────────────────────
      const inventoryItem = await SellerInventory.findOne({
        _id: inventoryId,
        sellerId: sellerId
      });

      if (!inventoryItem) {
        return res.status(404).json({
          success: false,
          message: "Inventory item not found"
        });
      }

      // ─────────────────────────────────
      // RECORD OLD PRICE IN HISTORY
      // ─────────────────────────────────
      const oldPrice = inventoryItem.sellerPrice;

      inventoryItem.priceEditHistory.push({
        oldPrice: oldPrice,
        newPrice: sellerPrice,
        editedAt: new Date()
      });

      // ─────────────────────────────────
      // UPDATE ONLY THE PRICE
      // Nothing else changes
      // ─────────────────────────────────
      inventoryItem.sellerPrice = sellerPrice;

      await inventoryItem.save();

      // Sync the price update to the seller's cloned Product in the catalog
      await Product.updateOne(
        { adminProductId: inventoryItem.productId, sellerId: sellerId },
        { $set: { price: sellerPrice, salePrice: sellerPrice } }
      );

      console.log(
        `✅ Price updated & synced: ₹${oldPrice} → ₹${sellerPrice}`
      );

      return res.status(200).json({
        success: true,
        message: `Price updated from ₹${oldPrice} to ₹${sellerPrice}`,
        data: {
          inventoryId: inventoryItem._id,
          productName: inventoryItem.productName,
          oldPrice: oldPrice,
          newPrice: inventoryItem.sellerPrice,
          originalPrice: inventoryItem.originalPrice,
          updatedAt: inventoryItem.updatedAt
        }
      });

    } catch (error) {
      console.error("❌ Error updating price:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update price"
      });
    }
  }
);

// ═══════════════════════════════════════════════
// SECURITY: Block any other edit attempts
// This catches any PATCH attempts on other fields
// ═══════════════════════════════════════════════
router.patch(
  "/:inventoryId",
  verifyToken,
  allowRoles("seller"),
  async (req, res) => {
    return res.status(403).json({
      success: false,
      message:
        "❌ Not allowed. Sellers can only edit price. " +
        "Use PATCH /api/seller-inventory/:id/price"
    });
  }
);

export default router;
