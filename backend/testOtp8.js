import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import OrderOtp from './app/models/orderOtp.js';
import Order from './app/models/order.js';
import { verifyHandoffOtpAndDeliver } from './app/services/orderWorkflowService.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await OrderOtp.deleteMany({ orderId: "ORD1783255779148" });
    await Order.updateOne({ orderId: "ORD1783255779148" }, { $set: { workflowStatus: "OUT_FOR_DELIVERY", status: "out_for_delivery" } });
    
    const order = await Order.findOne({ orderId: "ORD1783255779148" });
    const code = "9999";
    
    await OrderOtp.create({
      orderId: order.orderId,
      deliveryId: order.deliveryBoy,
      type: "handoff",
      codeHash: OrderOtp.hashCode(code),
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
      attempts: 0,
      maxAttempts: 3
    });
    
    console.log("Verifying OTP...");
    const result = await verifyHandoffOtpAndDeliver(
      order.deliveryBoy.toString(),
      "ORD1783255779148",
      code
    );
    console.log("Success! Result keys:", Object.keys(result));
  } catch (err) {
    console.error("Error thrown:", err.statusCode, err.message, err.stack);
  } finally {
    await mongoose.disconnect();
  }
}
run();
