import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import OrderOtp from './app/models/orderOtp.js';
import Order from './app/models/order.js';
import { verifyHandoffOtpAndDeliver } from './app/services/orderWorkflowService.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await OrderOtp.updateOne({ orderId: "ORD1783255779148" }, { $unset: { consumedAt: 1 }, $set: { attempts: 0, codeHash: OrderOtp.hashCode("1234") } });
    await Order.updateOne({ orderId: "ORD1783255779148" }, { $set: { workflowStatus: "OUT_FOR_DELIVERY", status: "out_for_delivery" } });
    
    const order = await Order.findOne({ orderId: "ORD1783255779148" });
    const result = await verifyHandoffOtpAndDeliver(
      order.deliveryBoy.toString(),
      "ORD1783255779148",
      "1234"
    );
    console.log("Success! Result:", result);
  } catch (err) {
    console.error("Error thrown:", err.statusCode, err.message, err.stack);
  } finally {
    await mongoose.disconnect();
  }
}
run();
