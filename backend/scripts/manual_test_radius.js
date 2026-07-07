import mongoose from "mongoose";
import dotenv from "dotenv";
import Seller from "../app/models/seller.js";
import Product from "../app/models/product.js";
import { checkProductAvailability } from "../utils/locationService.js";
import { calculateDistance } from "../utils/locationService.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Find a seller who has location coordinates and configured radius
  const seller = await Seller.findOne({
    "location.coordinates": { $exists: true, $ne: [] },
    serviceRadius: { $exists: true }
  }).lean();

  if (!seller) {
    console.error("No seller found with location coordinates and serviceRadius. Please add one first.");
    process.exit(1);
  }

  const [lng, lat] = seller.location.coordinates;
  const radius = seller.serviceRadius;
  console.log(`\nTesting with Seller: ${seller.shopName}`);
  console.log(`Seller Location: lat: ${lat}, lng: ${lng}`);
  console.log(`Configured Service Radius: ${radius} km`);
  console.log(`Effective Radius (+5km Buffer): ${radius + 5} km\n`);

  // We'll create mock customer locations at 3 distances:
  // 1. Inside original radius (e.g. 5km away)
  // 2. In the buffer zone (e.g. configured radius + 2.5km away)
  // 3. Beyond buffer zone (e.g. configured radius + 6km away)
  
  // Calculate latitude adjustments roughly (1 degree lat = ~111km)
  const dLatInside = 5 / 111;
  const dLatBuffer = (radius + 2.5) / 111;
  const dLatOutside = (radius + 6) / 111;

  const cases = [
    {
      name: "1. Inside Configured Radius",
      lat: lat + dLatInside,
      lng: lng
    },
    {
      name: "2. In Buffer Zone (Within +5km Extension)",
      lat: lat + dLatBuffer,
      lng: lng
    },
    {
      name: "3. Beyond Buffer Zone",
      lat: lat + dLatOutside,
      lng: lng
    }
  ];

  // Find one active product of this seller
  const product = await Product.findOne({ sellerId: seller._id, status: "active" }).lean();

  for (const c of cases) {
    const distance = calculateDistance(lat, lng, c.lat, c.lng);
    const mockProduct = product ? { ...product, seller } : { sellerId: seller, zoneOutDeliveryEnabled: true };
    const availability = checkProductAvailability(mockProduct, { lat: c.lat, lng: c.lng });

    console.log(`=== Case: ${c.name} ===`);
    console.log(`Customer Location: lat: ${c.lat.toFixed(4)}, lng: ${c.lng.toFixed(4)}`);
    console.log(`Calculated Distance: ${distance.toFixed(2)} km`);
    console.log(`Product Available: ${availability.available}`);
    console.log(`Delivery Type: ${availability.deliveryType}`);
    console.log(`-----------------------------------------\n`);
  }

  process.exit(0);
}

run();
