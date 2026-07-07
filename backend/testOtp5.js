import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Order from './app/models/order.js';
import OrderOtp from './app/models/orderOtp.js';
import { verifyHandoffOtpAndDeliver } from './app/services/orderWorkflowService.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const order = await Order.findOne({ orderId: "ORD1783255779148" });
    if (!order) return;
    
    // Reset order to OUT_FOR_DELIVERY
    order.workflowStatus = "OUT_FOR_DELIVERY";
    order.status = "out_for_delivery";
    await order.save();

    // Reset OTP
    const otp = await OrderOtp.findOne({ orderId: "ORD1783255779148" });
    otp.consumedAt = null;
    otp.attempts = 0;
    
    // We need the valid OTP code to test success. What is the codeHash?
    // Wait, OrderOtp has codeHash. We can't easily unhash. Let's just mock the match or overwrite it.
    const validCode = "1234";
    otp.codeHash = OrderOtp.hashCode(validCode);
    await otp.save();

    console.log("State reset. Running verifyHandoffOtpAndDeliver...");

    const result = await verifyHandoffOtpAndDeliver(
      order.deliveryBoy.toString(),
      "ORD1783255779148",
      validCode
    );
    console.log("Success! Result:", result);

  } catch (err) {
    console.error("Error thrown:", err.statusCode, err.message, err.stack);
  } finally {
    await mongoose.disconnect();
  }
}
run();
