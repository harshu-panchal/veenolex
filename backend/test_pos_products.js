import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const { getPOSProducts } = await import('./app/services/pos/posProductService.js');
    const products = await getPOSProducts({ limit: 10 });
    console.log("Returned products count:", products.length);
    if (products.length > 0) {
      console.log("First product:", JSON.stringify(products[0], null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
