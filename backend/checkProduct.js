import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkProduct() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = (await import('./app/models/product.js')).default;
    const product = await Product.findOne({ adminProductId: { $exists: true } }).lean();
    console.log(product);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkProduct();
