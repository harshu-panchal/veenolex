import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Order from './app/models/order.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const order = await Order.findOne({ orderId: "ORD1783255779148" });
    console.log("Customer field:", order.customer);
  } finally {
    await mongoose.disconnect();
  }
}
run();
