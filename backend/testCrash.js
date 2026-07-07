import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Order from './app/models/order.js';
import { rescheduleOrderAtomic } from './app/services/orderWorkflowService.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const order = await Order.findOne({ orderId: "ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ" });
    if (!order) {
      console.log("No order found");
      return;
    }
    
    // reset status for test
    order.status = "confirmed";
    order.workflowStatus = "DELIVERY_ASSIGNED";
    await order.save();

    console.log("Found order:", order.orderId);
    
    const newDate = new Date(Date.now() + 1000 * 60 * 60 * 24); 
    const result = await rescheduleOrderAtomic(order.orderId, "delivery_partner", newDate);
    
    console.log("Reschedule result:", result.order.status);
  } catch (err) {
    console.error("CRASH ERROR:", err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
