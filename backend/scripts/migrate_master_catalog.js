import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://veenolexharbal_db_user:mMcgJcIKMhZhzSr5@cluster0.srtooj0.mongodb.net/zoogno?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    console.log("Connected successfully.");

    // Find all products where adminProductId is undefined, null, or "none",
    // and sellerId is not null/undefined
    const legacyProducts = await db.collection('products').find({
      $and: [
        {
          $or: [
            { adminProductId: { $exists: false } },
            { adminProductId: null },
            { adminProductId: "none" }
          ]
        },
        { sellerId: { $ne: null } },
        { sellerId: { $exists: true } }
      ]
    }).toArray();

    console.log(`Found ${legacyProducts.length} legacy seller-created products that need migration.`);

    for (const prod of legacyProducts) {
      const oldSellerId = prod.sellerId;
      const prodIdStr = prod._id.toString();
      console.log(`\nMigrating product: "${prod.name}" (ID: ${prodIdStr}, SKU: ${prod.sku}, Current Seller: ${oldSellerId})`);

      // 1. Check if a clone already exists for this seller pointing to this master product
      const existingClone = await db.collection('products').findOne({
        adminProductId: prod._id,
        sellerId: oldSellerId
      });

      if (existingClone) {
        console.log(`- Cloned product already exists for seller ${oldSellerId}: ID ${existingClone._id}, SKU: ${existingClone.sku}`);
      } else {
        // Create cloned product for original seller so they retain their catalog list
        const cloneObj = {
          ...prod,
          sellerId: oldSellerId,
          adminProductId: prod._id,
          slug: `${prod.slug}-${oldSellerId.toString().slice(-6)}`,
          sku: `${prod.sku || 'SKU'}-${oldSellerId.toString().slice(-6)}`,
          approvalStatus: "approved",
          status: "active"
        };
        delete cloneObj._id; // Remove original ID so Mongo inserts a new document

        const insertResult = await db.collection('products').insertOne(cloneObj);
        console.log(`- Created cloned product for seller ${oldSellerId}: ID ${insertResult.insertedId}`);
      }

      // 2. Set original product sellerId to null (admin/master catalog)
      // and ensure status is active and approvalStatus is approved
      const updateResult = await db.collection('products').updateOne(
        { _id: prod._id },
        {
          $set: {
            sellerId: null,
            adminProductId: "none",
            approvalStatus: "approved",
            status: "active"
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        console.log(`- Updated original product to master catalog (sellerId set to null)`);
      } else {
        console.log(`- Original product was already updated or not modified`);
      }
    }

    console.log("\nMigration completed successfully.");

  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
