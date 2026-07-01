import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("No MONGO_URI found in environment variables");
  process.exit(1);
}

const migrate = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    // Update Products
    console.log("Updating Products...");
    const productResult = await mongoose.connection.db.collection('products').updateMany(
      { zoneOutDeliveryEnabled: { $exists: false } }, // Target only if not exists
      { 
        $set: { 
          zoneOutDeliveryEnabled: true,
          shippingPartner: "SELLER",
          zoneOutPrice: null
        } 
      }
    );
    console.log(`Matched ${productResult.matchedCount} products. Updated ${productResult.modifiedCount} products.`);

    // Update Orders
    console.log("Updating Orders...");
    const orderResult = await mongoose.connection.db.collection('orders').updateMany(
      { deliveryType: { $exists: false } },
      {
        $set: {
          deliveryType: "SELLER_DIRECT",
          isOutOfZone: false,
          shippingCost: 0,
          shipRocketDetails: {
            orderId: "",
            trackingNumber: "",
            status: "",
            estimatedDelivery: null
          }
        }
      }
    );
    console.log(`Matched ${orderResult.matchedCount} orders. Updated ${orderResult.modifiedCount} orders.`);

    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
