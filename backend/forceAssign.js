import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "./app/models/order.js";
import Delivery from "./app/models/delivery.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const delivery = await Delivery.findOne({ phone: "9340425758" });
    const orderId = "ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ";
    const order = await Order.findOne({ orderId });
    if (!order) {
      console.log("Order not found!");
      return;
    }
    order.status = "out_for_delivery";
    order.workflowStatus = "OUT_FOR_DELIVERY";
    order.deliveryBoy = delivery._id;
    order.rescheduledFor = null;
    await order.save();
    console.log("SUCCESS: Order ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ assigned to priyank, state set to OUT_FOR_DELIVERY");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
