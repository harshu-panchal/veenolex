import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Order from './app/models/order.js';
import { rescheduleOrderAtomic } from './app/services/orderWorkflowService.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const order = await Order.findOne({ workflowStatus: "OUT_FOR_DELIVERY" });
    if (!order) {
      console.log("No OUT_FOR_DELIVERY order found");
      return;
    }
    console.log("Found order:", order.orderId);
    
    // Simulate customer reschedule
    const newDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // Tomorrow
    const result = await rescheduleOrderAtomic(order.orderId, "customer", newDate);
    
    console.log("Reschedule result:", result.order.status, result.order.scheduledFor, result.order.rescheduledFor);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
