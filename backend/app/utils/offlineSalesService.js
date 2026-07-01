import OfflineSale from "../models/offlineSale.js";
import Product from "../models/product.js";
import Seller from "../models/seller.js";
import mongoose from "mongoose";

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION: Record Offline Sale
// ═══════════════════════════════════════════════════════════════
export const recordOfflineSale = async (saleData) => {
  try {
    console.log("🛒 Recording offline sale...", saleData);

    const { sellerId, items, paymentMethod } = saleData;

    if (!items || items.length === 0) {
      throw new Error("No items provided for sale");
    }

    // STEP 1: Verify seller exists
    console.log("1️⃣ Verifying seller...");
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new Error("Seller not found");
    }

    // STEP 2 & 3 & 4: Fetch products, verify ownership, check stock, calculate total
    console.log("2️⃣ Fetching products and validating...");
    let grandTotal = 0;
    const processedItems = [];
    const productDocsToSave = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (product.sellerId.toString() !== sellerId.toString()) {
        throw new Error(`❌ Seller does not own product: ${product.name}`);
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `❌ Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`
        );
      }

      const subTotal = product.price * item.quantity;
      grandTotal += subTotal;

      processedItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        pricePerUnit: product.price,
        subTotal: subTotal
      });

      // Prepare for stock deduction
      product.stock -= item.quantity;
      productDocsToSave.push(product);
    }

    // STEP 5: Create offline sale record
    console.log("5️⃣ Creating offline sale record...");
    const offlineSale = await OfflineSale.create({
      sellerId: sellerId,
      sellerName: seller.businessName || seller.name,
      customerName: saleData.customerName,
      customerPhone: saleData.customerPhone,
      items: processedItems,
      totalAmount: grandTotal,
      paymentMethod: paymentMethod || "CASH",
      notes: saleData.notes || ""
    });

    console.log("✅ Offline sale created:", offlineSale._id);

    // STEP 6: Decrease product stock
    console.log("6️⃣ Decreasing product stock...");
    for (const productDoc of productDocsToSave) {
      await productDoc.save();
    }
    console.log("✅ Stock decreased for all items");

    // STEP 7: Return confirmation
    const response = {
      success: true,
      message: "Offline sale recorded successfully",
      saleId: offlineSale._id,
      itemsSold: processedItems.length,
      totalAmount: grandTotal,
      receipt: {
        saleId: offlineSale._id,
        sellerName: seller.businessName || seller.name,
        customerName: saleData.customerName,
        customerPhone: saleData.customerPhone,
        items: processedItems,
        totalAmount: grandTotal,
        paymentMethod: paymentMethod || "CASH",
        date: offlineSale.createdAt
      }
    };

    console.log("✅ Sale recorded successfully");
    return response;

  } catch (error) {
    console.error("❌ Error recording offline sale:", error.message);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════
// FETCH OFFLINE SALES HISTORY
// ═══════════════════════════════════════════════════════════════
export const getOfflineSalesHistory = async (sellerId, filters = {}) => {
  try {
    console.log("📋 Fetching offline sales history for seller:", sellerId);

    // Build query
    const query = { sellerId: sellerId };

    // Optional filters
    if (filters.productId) {
      query.productId = filters.productId;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Fetch sales
    const sales = await OfflineSale.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log(`✅ Found ${sales.length} offline sales`);
    return sales;

  } catch (error) {
    console.error("❌ Error fetching sales history:", error.message);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════
// GET OFFLINE SALES STATISTICS
// ═══════════════════════════════════════════════════════════════
export const getOfflineSalesStats = async (sellerId, days = 30) => {
  try {
    console.log(`📊 Calculating offline sales stats for ${days} days...`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate statistics
    const stats = await OfflineSale.aggregate([
      {
        $match: {
          sellerId: mongoose.Types.ObjectId(sellerId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalQuantity: { $sum: { $sum: "$items.quantity" } },
          avgSaleAmount: { $avg: "$totalAmount" },
          uniqueCustomers: { $addToSet: "$customerPhone" }
        }
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalQuantity: 1,
          avgSaleAmount: { $round: ["$avgSaleAmount", 2] },
          uniqueCustomers: { $size: "$uniqueCustomers" }
        }
      }
    ]);

    console.log("✅ Stats calculated:", stats[0]);
    return stats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalQuantity: 0,
      avgSaleAmount: 0,
      uniqueCustomers: 0
    };

  } catch (error) {
    console.error("❌ Error calculating stats:", error.message);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════
// DELETE OFFLINE SALE (and restore stock)
// ═══════════════════════════════════════════════════════════════
export const deleteOfflineSale = async (saleId) => {
  try {
    console.log("🗑️ Deleting offline sale:", saleId);

    // STEP 1: Find the sale
    const sale = await OfflineSale.findById(saleId);
    if (!sale) {
      throw new Error("Offline sale not found");
    }

    // STEP 2: Restore product stock
    console.log("2️⃣ Restoring product stock...");
    let restoredQuantity = 0;
    for (const item of sale.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock += item.quantity;
        await product.save();
        restoredQuantity += item.quantity;
      }
    }
    console.log(`✅ Stock restored for ${sale.items.length} items`);

    // STEP 3: Delete the sale record
    console.log("3️⃣ Deleting sale record...");
    await OfflineSale.findByIdAndDelete(saleId);

    console.log("✅ Sale deleted and stock restored");
    return {
      success: true,
      message: "Offline sale deleted and stock restored",
      restoredQuantity: restoredQuantity,
      restoredAmount: sale.totalAmount
    };

  } catch (error) {
    console.error("❌ Error deleting sale:", error.message);
    throw error;
  }
};
