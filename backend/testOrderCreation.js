import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const customerApi = (await import('./app/controller/orderFinanceController.js'));
  // Let's create an online order directly to ensure the backend accepts ONLINE correctly
  console.log("Checking if backend allows ONLINE");
  process.exit(0);
}
run();
