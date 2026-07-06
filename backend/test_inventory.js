import mongoose from "mongoose";
import dotenv from "dotenv";
import SellerProductRequest from "./app/models/sellerProductRequest.js";
import SellerInventory from "./app/models/sellerInventory.js";

dotenv.config({ path: "./.env" });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  
  // Find recent requests
  const requests = await SellerProductRequest.find({ deliveryWorkflowStatus: "DELIVERED" }).sort({ createdAt: -1 }).limit(3);
  console.log("Recent Delivered Requests:", JSON.stringify(requests.map(r => ({ id: r._id, reqNo: r.requestNumber, items: r.items })), null, 2));
  
  // Find all inventory
  const inv = await SellerInventory.find();
  console.log("Total Inventory Count:", inv.length);
  console.log("Inventory Dump:", JSON.stringify(inv.map(i => ({ sellerId: i.sellerId, productId: i.productId, stock: i.totalStock, req: i.requestId })), null, 2));
  
  process.exit(0);
}
run();
