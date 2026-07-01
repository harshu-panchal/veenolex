import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    const seller = await mongoose.connection.db.collection('sellers').findOne({ location: { $exists: true } });
    if (seller) {
      console.log(`Seller Name: "${seller.storeName || seller.name}"`);
      console.log(`Latitude: ${seller.location?.latitude || seller.location?.lat}`);
      console.log(`Longitude: ${seller.location?.longitude || seller.location?.lng}`);
      console.log(`Service Radius: ${seller.serviceRadius || 5} KM`);
    } else {
      console.log("No sellers found with location data.");
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
run();
