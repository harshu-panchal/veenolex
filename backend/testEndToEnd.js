import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function testEndToEnd() {
  await mongoose.connect(process.env.MONGO_URI);
  const SellerProductRequest = (await import('./app/models/sellerProductRequest.js')).default;
  const Product = (await import('./app/models/product.js')).default;
  
  // Find a completed request for the seller
  const sellerId = new mongoose.Types.ObjectId('6999782fd49e8099e8a7b11c');
  const deliveredReqs = await SellerProductRequest.find({ sellerId, status: 'DELIVERED' }).sort({ deliveredAt: -1 }).limit(5);
  
  console.log("Recently delivered requests:", deliveredReqs.length);
  for (const req of deliveredReqs) {
     console.log(`Request ${req._id}, Items:`, req.items);
     // For each item, see if it is in Product collection
     for (const item of req.items) {
       const product = await Product.findOne({ adminProductId: item.productId, sellerId });
       if (product) {
         console.log(`- Item ${item.productName} is in Product collection (ID: ${product._id})`);
       } else {
         console.log(`- Item ${item.productName} is NOT in Product collection!`);
       }
     }
  }
  process.exit(0);
}
testEndToEnd();
