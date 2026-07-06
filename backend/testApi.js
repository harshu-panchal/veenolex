import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function testApi() {
  await mongoose.connect(process.env.MONGO_URI);
  const Product = (await import('./app/models/product.js')).default;
  const sellerId = new mongoose.Types.ObjectId('6999782fd49e8099e8a7b11c');
  
  const products = await Product.find({ sellerId })
    .select("name slug adminProductId status approvalStatus createdAt")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
    
  console.log("Top 20 products for seller:");
  products.forEach(p => {
    console.log(`- ${p.name} (Admin: ${!!p.adminProductId}, Status: ${p.status}, Approval: ${p.approvalStatus}, Date: ${p.createdAt})`);
  });
  
  process.exit(0);
}
testApi();
