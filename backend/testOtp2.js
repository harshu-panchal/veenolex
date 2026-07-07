import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Order from './app/models/order.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const order = await Order.findOne({ orderId: "ORD1783255779148" });
    if (!order) {
      console.log("Order not found");
      return;
    }
    console.log("STATUS:", order.workflowStatus, order.status);
  } finally {
    await mongoose.disconnect();
  }
}
run();
