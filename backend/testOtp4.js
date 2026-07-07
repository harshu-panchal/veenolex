import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import OrderOtp from './app/models/orderOtp.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const otp = await OrderOtp.findOne({ orderId: "ORD1783255779148" });
    if (!otp) {
      console.log("OTP not found");
      return;
    }
    console.log("OTP consumedAt:", otp.consumedAt);
  } finally {
    await mongoose.disconnect();
  }
}
run();
