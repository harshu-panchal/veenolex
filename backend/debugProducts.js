import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function debugSellerProducts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = (await import('./app/models/product.js')).default;
    const Seller = (await import('./app/models/seller.js')).default;
    
    // Check all products for the seller
    const sellerId = new mongoose.Types.ObjectId('6999782fd49e8099e8a7b11c');
    const products = await Product.find({ sellerId }).select('name sku adminProductId status approvalStatus').lean();
    console.log("Seller products:", products.length);
    console.log("Cloned products:", products.filter(p => p.adminProductId).length);
    console.log("Details:", products.filter(p => p.adminProductId));

    // Get count of products where status=active
    const activeProducts = await Product.countDocuments({ sellerId, status: "active" });
    console.log("Active count:", activeProducts);

    // Get count of products with approvalStatus=approved
    const approvedProducts = await Product.countDocuments({ sellerId, approvalStatus: "approved" });
    console.log("Approved count:", approvedProducts);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugSellerProducts();
