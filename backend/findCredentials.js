import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Customer from "./app/models/customer.js";
import Seller from "./app/models/seller.js";
import Delivery from "./app/models/delivery.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const user = await Customer.findOne();
    const seller = await Seller.findOne();
    const delivery = await Delivery.findOne();

    console.log("Customer Phone:", user?.phone || "None");
    console.log("Seller Phone:", seller?.phone || "None");
    console.log("Delivery Phone:", delivery?.phone || "None");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
