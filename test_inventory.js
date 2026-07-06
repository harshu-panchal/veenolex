import mongoose from "mongoose";
import dotenv from "dotenv";
import SellerProductRequest from "./backend/app/models/sellerProductRequest.js";
import SellerInventory from "./backend/app/models/sellerInventory.js";

dotenv.config({ path: "./backend/.env" });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  const requests = await SellerProductRequest.find({ deliveryWorkflowStatus: "DELIVERED" }).limit(5);
  console.log("Delivered Requests:", requests.map(r => ({ id: r._id, reqNo: r.requestNumber, items: r.items })));
  
  const inv = await SellerInventory.find();
  console.log("Inventory Count:", inv.length);
  console.log("Inventory:", inv.map(i => ({ sellerId: i.sellerId, productId: i.productId, stock: i.totalStock })));
  
  process.exit(0);
}
run();
