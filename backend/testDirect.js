import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "./app/models/order.js";
import Delivery from "./app/models/delivery.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const orderId = "ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ";
    const order = await Order.findOne({ orderId });
    const delivery = await Delivery.findOne(); // grab a delivery boy

    // reset order back to OUT_FOR_DELIVERY so the user can test the reschedule flow
    order.status = "out_for_delivery";
    order.workflowStatus = "OUT_FOR_DELIVERY";
    order.deliveryBoy = delivery._id;
    order.rescheduledFor = null;
    await order.save();
    
    console.log("SUCCESS: Order reset to OUT_FOR_DELIVERY and assigned to", delivery.name);
  } catch (err) {
    console.error("DIRECT CALL ERROR:", err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
