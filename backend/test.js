import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.useDb("test");
  const SellerProductRequest = db.collection("sellerproductrequests");
  const request = await SellerProductRequest.findOne({}, { sort: { _id: -1 } });
  console.log("Last request:", request);
  process.exit(0);
});
