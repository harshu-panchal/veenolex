import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "./app/models/order.js";
import Delivery from "./app/models/delivery.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const delivery = await Delivery.findOne(); // get active delivery partner
    if (!delivery) {
      console.log("No delivery partner found!");
      return;
    }
    
    // Update the specific order that failed with 403
    const orderId = "ORD-01KWVDPPP4YM5G9F16XG30AWN1";
    const order = await Order.findOne({ orderId });
    if (order) {
      order.previousDeliveryBoy = delivery._id;
      await order.save();
      console.log(`SUCCESS: Set previousDeliveryBoy for ${orderId} to ${delivery.name} (${delivery._id})`);
    } else {
      console.log(`Order ${orderId} not found.`);
    }

    // Also let's update ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ just in case
    const order2 = await Order.findOne({ orderId: "ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ" });
    if (order2) {
      order2.previousDeliveryBoy = delivery._id;
      await order2.save();
      console.log(`SUCCESS: Set previousDeliveryBoy for ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ to ${delivery.name}`);
    }
  } catch (err) {
    console.error("Error updating previousDeliveryBoy:", err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
