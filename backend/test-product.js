import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGO_URI);

const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));

async function run() {
  const product = await Product.findOne({ status: "active" });
  console.log("product.sellerId is:", product.sellerId);
  mongoose.disconnect();
}
run();
