/**
 * Clears the storefront placeholder location out of existing data.
 *
 * Before checkout required a real address, the app seeded the delivery
 * address from a hardcoded placeholder, so some orders and customer profiles
 * hold that address instead of one the customer gave. This migration empties
 * those fields so every panel can say "no address on record" instead of
 * showing a place the customer never chose.
 *
 * Run:  node backend/migrations/clear-placeholder-addresses.js [--dry-run]
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("No MONGO_URI found in environment variables");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

// The placeholder that used to ship with the storefront.
const PLACEHOLDER_ADDRESS =
  "214, Rajshri Palace Colony, Pipliyahana, Indore, Madhya Pradesh 452018, India";
const PLACEHOLDER_LAT = 22.711140989838025;
const PLACEHOLDER_LNG = 75.9001552518043;

// Two different problems, which must not be treated the same way.
//
// 1. The whole address is the placeholder — nothing here came from the
//    customer, so the text and the coordinates both go.
const placeholderTextMatch = { "address.address": PLACEHOLDER_ADDRESS };

// 2. The customer typed a real address while the map pin was still sitting on
//    the placeholder, so only the COORDINATES are wrong. Blanking the text
//    here would destroy an address the customer actually gave us; drop the
//    coordinates alone so nothing navigates to the placeholder.
const placeholderCoordsOnlyMatch = {
  "address.location.lat": PLACEHOLDER_LAT,
  "address.location.lng": PLACEHOLDER_LNG,
  "address.address": { $nin: [PLACEHOLDER_ADDRESS, "", null] },
};

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected${DRY_RUN ? " (dry run — nothing will be written)" : ""}.`);

  const db = mongoose.connection.db;

  const orders = db.collection("orders");

  const orderCount = await orders.countDocuments(placeholderTextMatch);
  console.log(`Orders whose whole address is the placeholder: ${orderCount}`);
  if (orderCount && !DRY_RUN) {
    const res = await orders.updateMany(placeholderTextMatch, {
      $set: { "address.address": "", "address.city": "", "address.state": "", "address.pincode": "" },
      $unset: { "address.location": "" },
    });
    console.log(`  cleared on ${res.modifiedCount} orders`);
  }

  const coordsOnlyCount = await orders.countDocuments(placeholderCoordsOnlyMatch);
  console.log(`Orders with a real address but the placeholder's coordinates: ${coordsOnlyCount}`);
  if (coordsOnlyCount && !DRY_RUN) {
    const res = await orders.updateMany(placeholderCoordsOnlyMatch, {
      $unset: { "address.location": "" },
    });
    console.log(`  coordinates dropped on ${res.modifiedCount} orders (address text kept)`);
  }

  // Customers live in `users` (Order.customer refs the "User" model). An
  // earlier draft of this script read a `customers` collection, which does
  // not exist, so both customer passes below silently cleared nothing.
  const customers = db.collection("users");
  const customerMatch = {
    $or: [
      { "location.address": PLACEHOLDER_ADDRESS },
      { "location.latitude": PLACEHOLDER_LAT, "location.longitude": PLACEHOLDER_LNG },
    ],
  };
  const customerCount = await customers.countDocuments(customerMatch);
  console.log(`Customers holding the placeholder location: ${customerCount}`);
  if (customerCount && !DRY_RUN) {
    const res = await customers.updateMany(customerMatch, { $unset: { location: "" } });
    console.log(`  cleared on ${res.modifiedCount} customers`);
  }

  // Saved address books can carry it too.
  const savedMatch = { "addresses.fullAddress": PLACEHOLDER_ADDRESS };
  const savedCount = await customers.countDocuments(savedMatch);
  console.log(`Customers with the placeholder in their saved addresses: ${savedCount}`);
  if (savedCount && !DRY_RUN) {
    const res = await customers.updateMany(savedMatch, {
      $pull: { addresses: { fullAddress: PLACEHOLDER_ADDRESS } },
    });
    console.log(`  removed from ${res.modifiedCount} customers`);
  }

  await mongoose.disconnect();
  console.log("Done.");
};

run().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
