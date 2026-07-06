import mongoose from 'mongoose';
import 'dotenv/config';
import SellerProductRequest from './app/models/sellerProductRequest.js';

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const reqs = await SellerProductRequest.find({ status: "PENDING" }).sort({createdAt: -1}).limit(2);
  console.log("Pending requests:", reqs.map(r => r.requestNumber));
  
  const req = reqs[0];
  if (!req) return console.log("No pending request");
  
  try {
    const year = new Date().getFullYear();
    const count = await SellerProductRequest.countDocuments();
    console.log(`Current count is ${count}`);
    req.status = "APPROVED";
    req.invoiceNumber = `INV-${year}-${String(count).padStart(4, "0")}`;
    req.invoiceGeneratedAt = new Date();
    await req.save();
    console.log(`Saved successfully. Assigned invoice: ${req.invoiceNumber}`);
  } catch (err) {
    console.error("Save error:", err);
  }
  process.exit(0);
}
test();
