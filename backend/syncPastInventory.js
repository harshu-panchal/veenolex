import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function syncPast() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = (await import('./app/models/product.js')).default;
    const SellerInventory = (await import('./app/models/sellerInventory.js')).default;
    
    const inventories = await SellerInventory.find();
    let clonedCount = 0;
    
    for (const inv of inventories) {
      if (!inv.productId) continue;
      
      const adminProduct = await Product.findById(inv.productId);
      if (!adminProduct) continue;
      
      let clonedProduct = await Product.findOne({ adminProductId: adminProduct._id, sellerId: inv.sellerId });
      
      if (!clonedProduct) {
        const uniqueSuffix = `-${inv.sellerId.toString().slice(-6)}-${Date.now().toString().slice(-4)}`;
        const clonedData = {
          ...adminProduct.toObject(),
          _id: new mongoose.Types.ObjectId(),
          sellerId: inv.sellerId,
          adminProductId: adminProduct._id,
          stock: inv.totalStock || inv.availableStock,
          slug: `${adminProduct.slug}${uniqueSuffix}`,
          sku: `${adminProduct.sku || 'SKU'}${uniqueSuffix}`,
          lastSubmittedByRole: "admin",
          approvalStatus: "approved",
          approvalNote: "Automatically approved from admin warehouse delivery (Retrospective Sync).",
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        delete clonedData.__v;
        await Product.create(clonedData);
        clonedCount++;
        console.log(`Cloned ${adminProduct.name} for seller ${inv.sellerId}`);
      } else {
        // We shouldn't necessarily update stock here because it might double-count if we run this multiple times
        console.log(`Already exists: ${adminProduct.name} for seller ${inv.sellerId}`);
      }
    }
    
    console.log(`Successfully synced ${clonedCount} past deliveries into Product catalog.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

syncPast();
