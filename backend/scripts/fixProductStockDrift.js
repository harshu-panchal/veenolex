/**
 * One-off: repair stock that drifted between the product-level number
 * (what sellers manage) and single-variant stock (what old seller clones
 * copied from the admin master), and clamp negatives to 0.
 *
 *   node scripts/fixProductStockDrift.js           # dry run, lists changes
 *   node scripts/fixProductStockDrift.js --apply   # writes them
 */
import "dotenv/config";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const products = mongoose.connection.db.collection("products");

const rows = await products
  .find({ $or: [{ stock: { $lt: 0 } }, { "variants.0": { $exists: true } }] })
  .project({ name: 1, sellerId: 1, stock: 1, variants: 1 })
  .toArray();

const changes = [];
for (const p of rows) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const stock = Math.max(0, Number(p.stock || 0));
  const set = {};
  if (Number(p.stock || 0) !== stock) set.stock = stock;
  if (variants.length === 1 && Number(variants[0].stock || 0) !== stock) {
    set["variants.0.stock"] = stock;
  }
  if (Object.keys(set).length) {
    changes.push({ p, set, before: { stock: p.stock, variant: variants.length === 1 ? variants[0].stock : null } });
  }
}

for (const { p, set, before } of changes) {
  const after = { stock: set.stock ?? p.stock, variant: set["variants.0.stock"] ?? before.variant };
  console.log(
    `${String(p.name).padEnd(22)} ${p.sellerId ? "seller " + p.sellerId : "ADMIN master            "}  ` +
    `stock ${before.stock} -> ${after.stock}   variant ${before.variant} -> ${after.variant}`,
  );
  if (apply) await products.updateOne({ _id: p._id }, { $set: set });
}
console.log(`\n${changes.length} product(s) ${apply ? "updated" : "would change (dry run; pass --apply)"}`);
await mongoose.disconnect();
