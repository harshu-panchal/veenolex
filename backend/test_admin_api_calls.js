import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://veenolexharbal_db_user:mMcgJcIKMhZhzSr5@cluster0.srtooj0.mongodb.net/zoogno?retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const admin = await db.collection('admins').findOne({ email: "harshvardhanpanc145@gmail.com" });
    if (!admin) {
      console.error("Admin not found!");
      return;
    }

    const token = jwt.sign({ id: admin._id, role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
    const headers = { Authorization: `Bearer ${token}` };
    const sellerId = "6999782fd49e8099e8a7b11c"; // Harsh's Hub

    // Products
    const res1 = await axios.get(`http://localhost:3001/api/products?sellerId=${sellerId}&limit=100`, { headers });
    console.log("Products result keys:", Object.keys(res1.data.result));
    console.log("Products result.items length:", res1.data.result.items?.length);

    // Orders
    const res2 = await axios.get(`http://localhost:3001/api/orders/seller-orders?sellerId=${sellerId}&limit=100`, { headers });
    console.log("Orders result keys:", Object.keys(res2.data.result));
    console.log("Orders result.items length:", res2.data.result.items?.length);

  } catch (err) {
    console.error("Error:", err.stack || err);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
  } finally {
    await mongoose.disconnect();
  }
}
run();
