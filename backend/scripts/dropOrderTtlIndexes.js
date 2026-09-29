/**
 * One-off: drop the TTL indexes that auto-deleted orders / checkout groups
 * 24h after placement whenever a request carried an idempotency key.
 * Idempotency replay records live in their own store; the documents
 * themselves must never expire. Safe to re-run.
 *
 *   node scripts/dropOrderTtlIndexes.js
 */
import "dotenv/config";
import mongoose from "mongoose";

const INDEX = "placement.idempotencyKeyExpiry_1";

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const db = mongoose.connection.db;
for (const name of ["orders", "checkoutgroups"]) {
  const exists = (await db.collection(name).indexes()).some((i) => i.name === INDEX);
  if (exists) {
    await db.collection(name).dropIndex(INDEX);
    console.log(`${name}: dropped ${INDEX}`);
  } else {
    console.log(`${name}: ${INDEX} not present`);
  }
  const unset = await db.collection(name).updateMany(
    { "placement.idempotencyKeyExpiry": { $exists: true } },
    { $unset: { "placement.idempotencyKeyExpiry": "" } },
  );
  if (unset.modifiedCount) console.log(`${name}: cleared expiry on ${unset.modifiedCount} docs`);
}
await mongoose.disconnect();
