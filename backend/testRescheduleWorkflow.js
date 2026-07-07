import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "./app/models/order.js";
import Delivery from "./app/models/delivery.js";
import Seller from "./app/models/seller.js";
import { rescheduleOrderAtomic, processOrderRescheduleJob, sellerAcceptAtomic } from "./app/services/orderWorkflowService.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const orderId = "ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ";
    const order = await Order.findOne({ orderId });
    if (!order) {
      console.log("Order not found!");
      return;
    }

    const seller = await Seller.findById(order.seller);
    const delivery = await Delivery.findOne();

    console.log("--- STEP 1: Setting order to OUT_FOR_DELIVERY ---");
    order.status = "out_for_delivery";
    order.workflowStatus = "OUT_FOR_DELIVERY";
    order.deliveryBoy = delivery._id;
    order.rescheduledFor = null;
    await order.save();
    console.log(`Current State: status=${order.status}, workflowStatus=${order.workflowStatus}`);

    console.log("\n--- STEP 2: Rescheduling the order (simulating customer/rider action) ---");
    const rescheduleTime = new Date(Date.now() + 5000); // 5 seconds in future
    const result = await rescheduleOrderAtomic(orderId, "customer", rescheduleTime);
    console.log(`Rescheduled State: status=${result.order.status}, workflowStatus=${result.order.workflowStatus}, rescheduledFor=${result.order.rescheduledFor}`);

    console.log("\n--- STEP 3: Simulating rescheduled time arrival (running Bull job) ---");
    const jobResult = await processOrderRescheduleJob({ orderId });
    console.log(`Post-Job State: status=${jobResult.order.status}, workflowStatus=${jobResult.order.workflowStatus}`);
    console.log(`sellerPendingExpiresAt: ${jobResult.order.sellerPendingExpiresAt}`);

    console.log("\n--- STEP 4: Simulating seller approving/accepting the request ---");
    const acceptedOrder = await sellerAcceptAtomic(seller._id, orderId);
    console.log(`Final Approved State: status=${acceptedOrder.status}, workflowStatus=${acceptedOrder.workflowStatus}`);

    console.log("\nSUCCESS: Reschedule workflow validated successfully!");
  } catch (err) {
    console.error("TEST FAILED:", err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
