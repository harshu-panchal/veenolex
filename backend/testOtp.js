import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { verifyHandoffOtpAndDeliver } from './app/services/orderWorkflowService.js';
import Order from './app/models/order.js';
import OrderOtp from './app/models/orderOtp.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const order = await Order.findOne({ orderId: "ORD1783255779148" });
    if (!order) {
      console.log("Order not found");
      return;
    }
    const otp = await OrderOtp.findOne({ orderId: "ORD1783255779148" });
    console.log("Running verify with", order.deliveryBoy.toString(), "ORD1783255779148", otp ? "mock-otp" : "none");
    
    await verifyHandoffOtpAndDeliver(
      order.deliveryBoy.toString(),
      "ORD1783255779148",
      "0000" // we expect OTP_MISMATCH (403) or OTP_CONSUMED (409) or ORDER_NOT_READY (409)
    );
    console.log("Success");
  } catch (err) {
    console.error("Error thrown:", err.statusCode, err.message, err.stack);
  } finally {
    await mongoose.disconnect();
  }
}
run();
