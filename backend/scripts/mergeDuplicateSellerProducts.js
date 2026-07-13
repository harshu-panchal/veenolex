/**
 * ═══════════════════════════════════════════════════════════════
 * MERGE DUPLICATE SELLER PRODUCTS (CHAIN-SAFE VERSION)
 * ═══════════════════════════════════════════════════════════════
 *
 * This script finds seller products that were cloned multiple times
 * from the same admin master product, even if they were chain-cloned
 * (where clone B points to clone A instead of the root master).
 *
 * It recursively traces the `adminProductId` chain to find the
 * true Master Catalog Product ID, groups duplicates by:
 *   (sellerId, trueMasterProductId)
 * and merges them.
 *
 * Usage:
 *   node scripts/mergeDuplicateSellerProducts.js          # Dry run (preview only)
 *   node scripts/mergeDuplicateSellerProducts.js --execute # Actually merge
 *
 * ═══════════════════════════════════════════════════════════════
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not set in .env");
  process.exit(1);
}

const executeMode = process.argv.includes("--execute");

async function run() {
  console.log("═══════════════════════════════════════════════════");
  console.log(executeMode ? "🔴 EXECUTE MODE — Changes WILL be applied" : "🟢 DRY RUN MODE — No changes will be made");
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const Product = mongoose.connection.collection("products");

  // 1. Fetch all products from the database to build an in-memory lookup map
  console.log("📦 Fetching all products to resolve cloning chains...");
  const allProducts = await Product.find({}).toArray();
  const productMap = new Map();
  for (const p of allProducts) {
    productMap.set(p._id.toString(), p);
  }
  console.log(`✅ Loaded ${productMap.size} products into memory.\n`);

  // Helper to trace back to the true root master product ID
  function findTrueMasterId(productIdStr) {
    const visited = new Set();
    let currentId = productIdStr;
    let rootProduct = productMap.get(currentId);

    while (rootProduct && rootProduct.adminProductId) {
      const parentIdStr = rootProduct.adminProductId.toString();
      if (visited.has(parentIdStr)) {
        console.warn(`⚠️ Circular reference detected for product ID: ${currentId}`);
        break; // Prevent infinite loops
      }
      visited.add(parentIdStr);
      
      const parentProduct = productMap.get(parentIdStr);
      if (!parentProduct) {
        // Parent not in map, so this parentId is the furthest we can trace back
        return parentIdStr;
      }
      rootProduct = parentProduct;
      currentId = parentIdStr;
    }

    return rootProduct ? rootProduct._id.toString() : currentId;
  }

  // 2. Filter seller products and resolve their true master ID
  const sellerProducts = allProducts.filter(p => p.sellerId != null);
  
  // Group key: `${sellerId}_${trueMasterId}` -> list of products
  const groups = new Map();

  for (const p of sellerProducts) {
    const sellerIdStr = p.sellerId.toString();
    
    // If it has no adminProductId and was created directly by the seller, it has no master ID.
    // We only group products that were cloned (have an adminProductId anywhere in their chain).
    if (!p.adminProductId) {
      continue;
    }

    const trueMasterId = findTrueMasterId(p._id.toString());
    const groupKey = `${sellerIdStr}_${trueMasterId}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        sellerId: sellerIdStr,
        trueMasterId,
        name: p.name,
        items: []
      });
    }
    groups.get(groupKey).items.push(p);
  }

  // 3. Identify groups with duplicates
  const duplicateGroups = [];
  for (const [key, group] of groups.entries()) {
    if (group.items.length > 1) {
      duplicateGroups.push(group);
    }
  }

  if (duplicateGroups.length === 0) {
    console.log("🎉 No duplicate products found! Database is clean.");
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  Found ${duplicateGroups.length} groups of duplicate products:\n`);

  let totalMerged = 0;
  let totalDeleted = 0;

  for (const group of duplicateGroups) {
    // Sort items by createdAt ascending so the oldest one (first clone) is the keeper
    const sortedItems = group.items.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    const keeper = sortedItems[0];
    const duplicates = sortedItems.slice(1);
    const mergedStock = sortedItems.reduce((sum, p) => sum + (p.stock || 0), 0);

    console.log(`─────────────────────────────────────────`);
    console.log(`📦 Product: "${keeper.name}"`);
    console.log(`   True Master ID: ${group.trueMasterId}`);
    console.log(`   Seller ID: ${group.sellerId}`);
    console.log(`   Copies: ${sortedItems.length} (keeping 1, deleting ${duplicates.length})`);
    console.log(`   Keeper: ${keeper._id} (SKU: ${keeper.sku}, stock: ${keeper.stock})`);
    console.log(`   Merged stock: ${mergedStock}`);
    for (const dup of duplicates) {
      console.log(`   🗑️  Delete: ${dup._id} (SKU: ${dup.sku}, stock: ${dup.stock})`);
    }

    if (executeMode) {
      // 1. Update keeper to point directly to the true master product (clean up chain-cloning)
      // 2. Set its stock to the sum of all duplicates' stock
      await Product.updateOne(
        { _id: keeper._id },
        { 
          $set: { 
            stock: mergedStock,
            adminProductId: new mongoose.Types.ObjectId(group.trueMasterId)
          } 
        }
      );

      // Delete duplicates
      const deleteIds = duplicates.map((d) => d._id);
      const deleteResult = await Product.deleteMany({ _id: { $in: deleteIds } });
      console.log(`   ✅ Merged! Keeper stock → ${mergedStock}, deleted ${deleteResult.deletedCount} duplicates`);
      totalDeleted += deleteResult.deletedCount;
    }

    totalMerged++;
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`📊 Summary: ${totalMerged} product groups processed`);
  if (executeMode) {
    console.log(`   🗑️  ${totalDeleted} duplicate records deleted`);
  } else {
    console.log(`   ℹ️  Run with --execute to apply changes`);
  }
  console.log(`═══════════════════════════════════════════════════`);

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB");
}

run().catch((err) => {
  console.error("❌ Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
