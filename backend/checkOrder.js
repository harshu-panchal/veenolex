import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Order = (await import('./app/models/order.js')).default;
  const o = await Order.findOne({ orderId: 'ORD-01KWS5ZTGH9HFNWHMNE5Q12RWM' }).lean();
  console.log(o);
  process.exit(0);
}
run();
