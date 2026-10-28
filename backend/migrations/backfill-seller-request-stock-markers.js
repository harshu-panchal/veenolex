/**
 * Backfills the stock-movement markers on seller product requests, and
 * optionally pulls back stock that was credited to sellers too early.
 *
 * Seller requests used to credit the seller's catalogue at APPROVAL. They now
 * credit it only once the goods are delivered and paid for. Without a
 * backfill, requests that are mid-flight under the old rules would be
 * credited a second time when their delivery completes.
 *
 * What it does:
 *
 *  1. Marks every request that already left the warehouse
 *     (status beyond PENDING) with `warehouseStockReservedAt`, so the new
 *     approval-time decrement cannot run again on it.
 *
 *  2. Marks every request whose stock already reached the seller with
 *     `stockMaterializedAt`, so delivery cannot credit it twice. That is:
 *       - DELIVERED requests (correct under both old and new rules), and
 *       - APPROVED/DISPATCHED requests, which the old code credited at
 *         approval even though the goods are still in transit.
 *
 *  3. With --revert-undelivered, instead of (2) for the in-transit ones, it
 *     takes that premature stock back out of the seller's catalogue so those
 *     requests behave under the new rules: the stock lands when the rider's
 *     PIN is validated. Only stock this tool can account for is removed — a
 *     line is skipped if the seller has since sold any of it, because
 *     reversing that would push stock negative and corrupt sales history.
 *
 * Run:  node backend/migrations/backfill-seller-request-stock-markers.js [--dry-run] [--revert-undelivered]
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
const REVERT_UNDELIVERED = process.argv.includes("--revert-undelivered");

// Statuses that mean the carton has left the admin warehouse.
const LEFT_WAREHOUSE = ["APPROVED", "DISPATCHED", "DELIVERED"];
// Statuses where the goods are still in transit under the new rules.
const IN_TRANSIT = ["APPROVED", "DISPATCHED"];

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected${DRY_RUN ? " (dry run)" : ""}`);

  const SellerProductRequest = (
    await import("../app/models/sellerProductRequest.js")
  ).default;
  const SellerInventory = (await import("../app/models/sellerInventory.js"))
    .default;
  const Product = (await import("../app/models/product.js")).default;
  const {
    materializeSellerRequestStock,
    isRequestReadyForSellerStock,
  } = await import("../app/services/sellerRequestFulfillmentService.js");

  // ── 0. Tell old-code requests from new-code ones ──────────────────
  //
  // This must happen BEFORE the marker is backfilled, because the absence of
  // `warehouseStockReservedAt` is the only evidence that a request was
  // approved by the old code — and therefore had its stock credited to the
  // seller at approval time. A request that already carries the marker was
  // approved after the fix and has NOT been credited yet, so it must be left
  // alone or its legitimate credit on delivery would be suppressed.
  const preFixInTransitIds = (
    await SellerProductRequest.find({
      status: { $in: IN_TRANSIT },
      warehouseStockReservedAt: { $in: [null, undefined] },
      stockMaterializedAt: { $in: [null, undefined] },
    })
      .select("_id")
      .lean()
  ).map((r) => String(r._id));

  const preFixSet = new Set(preFixInTransitIds);
  console.log(
    `In-transit requests approved by the OLD code (already credited): ${preFixSet.size}`,
  );

  // ── 1. Warehouse reservation marker ──────────────────────────────
  const reserveFilter = {
    status: { $in: LEFT_WAREHOUSE },
    warehouseStockReservedAt: { $in: [null, undefined] },
  };
  const reserveCount = await SellerProductRequest.countDocuments(reserveFilter);
  if (!DRY_RUN && reserveCount > 0) {
    await SellerProductRequest.updateMany(reserveFilter, [
      { $set: { warehouseStockReservedAt: { $ifNull: ["$approvedAt", "$createdAt"] } } },
    ]);
  }
  console.log(`warehouseStockReservedAt backfilled: ${reserveCount}`);

  // ── 2. Delivered requests ─────────────────────────────────────────
  //
  // Split by the same discriminator as above. A delivered request approved by
  // the OLD code was credited at approval, so it only needs the marker. One
  // approved AFTER the fix was never credited, and if it was delivered while a
  // stale process was still serving pre-fix code its payment was not settled
  // either — leaving it delivered, unpaid and uncredited with no way forward.
  // Those are repaired here.
  const deliveredPreFix = await SellerProductRequest.find({
    status: "DELIVERED",
    stockMaterializedAt: { $in: [null, undefined] },
    warehouseStockReservedAt: { $in: [null, undefined] },
  })
    .select("_id deliveredAt updatedAt")
    .lean();

  if (!DRY_RUN && deliveredPreFix.length > 0) {
    await SellerProductRequest.updateMany(
      { _id: { $in: deliveredPreFix.map((r) => r._id) } },
      [{ $set: { stockMaterializedAt: { $ifNull: ["$deliveredAt", "$updatedAt"] } } }],
    );
  }
  console.log(
    `Delivered under OLD code, marked already-credited: ${deliveredPreFix.length}`,
  );

  const deliveredStuck = await SellerProductRequest.find({
    status: "DELIVERED",
    stockMaterializedAt: { $in: [null, undefined] },
    warehouseStockReservedAt: { $nin: [null, undefined] },
  }).lean();

  console.log(`Delivered but never credited (need repair): ${deliveredStuck.length}`);

  for (const request of deliveredStuck) {
    const needsSettlement =
      request.paymentType === "PAY_AFTER_DELIVERY" &&
      request.paymentStatus !== "PAID";

    console.log(
      `  ${request.requestNumber}: paid=${request.paymentStatus}` +
        (needsSettlement ? " -> settling (collected on delivery)" : ""),
    );

    if (DRY_RUN) continue;

    if (needsSettlement) {
      // Handover happened, so the rider took the cash with it.
      await SellerProductRequest.updateOne(
        { _id: request._id },
        {
          $set: {
            paymentStatus: "PAID",
            paidAt: request.deliveredAt || new Date(),
            collectedAmount: request.totalAmount || 0,
            collectedBy: request.deliveryBoy || null,
            collectedAt: request.deliveredAt || new Date(),
          },
        },
      );
    }

    const fresh = await SellerProductRequest.findById(request._id);
    if (!isRequestReadyForSellerStock(fresh)) {
      console.log(
        `    skipped: still not delivered-and-paid (paid=${fresh.paymentStatus})`,
      );
      continue;
    }

    try {
      const result = await materializeSellerRequestStock(fresh);
      console.log(
        `    ${result.materialized ? "credited to seller" : "not credited: " + result.reason}`,
      );
    } catch (err) {
      console.error(`    credit failed: ${err.message}`);
    }
  }

  // ── 3. In-transit requests credited early by the old code ─────────
  // Only requests the OLD code credited need settling here. Post-fix requests
  // are already correct: uncredited, waiting on delivery.
  const inTransit = (
    await SellerProductRequest.find({
      status: { $in: IN_TRANSIT },
      stockMaterializedAt: { $in: [null, undefined] },
    }).lean()
  ).filter((r) => preFixSet.has(String(r._id)));

  console.log(`In-transit requests to settle: ${inTransit.length}`);

  if (!REVERT_UNDELIVERED) {
    // Conservative default: leave the seller's current stock alone and just
    // record that it has already been credited, so delivery does not double it.
    if (!DRY_RUN && inTransit.length > 0) {
      await SellerProductRequest.updateMany(
        {
          _id: { $in: inTransit.map((r) => r._id) },
        },
        [{ $set: { stockMaterializedAt: { $ifNull: ["$approvedAt", "$createdAt"] } } }],
      );
    }
    console.log(
      `Marked as already-credited: ${inTransit.length} (pass --revert-undelivered to pull this stock back out instead)`,
    );
    await mongoose.disconnect();
    return;
  }

  let reverted = 0;
  let skipped = 0;

  for (const request of inTransit) {
    let allLinesReverted = true;

    for (const item of request.items || []) {
      const quantity = item.quantity || 0;
      if (!item.productId || quantity <= 0) continue;

      // Resolve the master product the same way the runtime does.
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const master = product.adminProductId
        ? (await Product.findById(product.adminProductId)) || product
        : product;

      const inventory = await SellerInventory.findOne({
        sellerId: request.sellerId,
        productId: master._id,
      });
      const sellerProduct = await Product.findOne({
        adminProductId: master._id,
        sellerId: request.sellerId,
      });

      // Refuse to reverse anything the seller has started selling, or where
      // the available stock no longer covers the amount we would remove.
      const invBlocked =
        inventory && Number(inventory.availableStock || 0) < quantity;
      const prodBlocked =
        sellerProduct && Number(sellerProduct.stock || 0) < quantity;

      if (invBlocked || prodBlocked) {
        console.warn(
          `  skip ${request.requestNumber} / ${item.productName}: seller stock already drawn down`,
        );
        allLinesReverted = false;
        skipped += 1;
        continue;
      }

      if (DRY_RUN) {
        reverted += 1;
        continue;
      }

      if (inventory) {
        inventory.availableStock = Number(inventory.availableStock || 0) - quantity;
        inventory.totalStock = Math.max(
          0,
          Number(inventory.totalStock || 0) - quantity,
        );
        if (inventory.totalStock === 0) inventory.status = "INACTIVE";
        await inventory.save();
      }

      if (sellerProduct) {
        sellerProduct.stock = Number(sellerProduct.stock || 0) - quantity;
        if (
          Array.isArray(sellerProduct.variants) &&
          sellerProduct.variants.length > 0
        ) {
          let vIndex = item.variantSku
            ? sellerProduct.variants.findIndex(
                (v) => String(v.sku || "").trim() === String(item.variantSku).trim(),
              )
            : 0;
          if (vIndex === -1) vIndex = 0;
          if (sellerProduct.variants[vIndex]) {
            sellerProduct.variants[vIndex].stock = Math.max(
              0,
              Number(sellerProduct.variants[vIndex].stock || 0) - quantity,
            );
          }
        }
        await sellerProduct.save();
      }

      reverted += 1;
    }

    // Only leave the request uncredited if every line came back cleanly;
    // otherwise it is partly with the seller already and must be treated as
    // credited so delivery does not top it up again.
    if (!DRY_RUN && !allLinesReverted) {
      await SellerProductRequest.updateOne(
        { _id: request._id },
        { $set: { stockMaterializedAt: request.approvedAt || request.createdAt } },
      );
    }
  }

  console.log(`Lines pulled back from sellers: ${reverted}`);
  console.log(`Lines skipped (already sold / insufficient): ${skipped}`);

  await mongoose.disconnect();
  console.log(DRY_RUN ? "Dry run complete; nothing written." : "Done.");
}

main().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
