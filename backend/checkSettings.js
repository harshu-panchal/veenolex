import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const settings = await db.collection('settings').findOne({});
  console.log(settings);
  process.exit(0);
}
run();
