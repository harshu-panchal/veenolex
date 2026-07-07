import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import OrderOtp from './app/models/orderOtp.js';
import Order from './app/models/order.js';
import { requestHandoffOtpAtomic, verifyHandoffOtpAndDeliver } from './app/services/orderWorkflowService.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await OrderOtp.deleteMany({ orderId: "ORD1783255779148" });
    await Order.updateOne({ orderId: "ORD1783255779148" }, { $set: { workflowStatus: "OUT_FOR_DELIVERY", status: "out_for_delivery" } });
    
    const order = await Order.findOne({ orderId: "ORD1783255779148" });
    
    console.log("Requesting OTP...");
    const otpRes = await requestHandoffOtpAtomic(order.deliveryBoy.toString(), "ORD1783255779148");
    const code = otpRes.code;
    console.log("OTP Code Generated:", code);
    
    console.log("Verifying OTP...");
    const result = await verifyHandoffOtpAndDeliver(
      order.deliveryBoy.toString(),
      "ORD1783255779148",
      code
    );
    console.log("Success! Result:", Object.keys(result));
  } catch (err) {
    console.error("Error thrown:", err.statusCode, err.message, err.stack);
  } finally {
    await mongoose.disconnect();
  }
}
run();
