import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Delivery from "./app/models/delivery.js";
import jwt from "jsonwebtoken";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const delivery = await Delivery.findOne(); // get any delivery partner
    const token = jwt.sign({ id: delivery._id, role: "delivery" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    
    console.log("Token:", token.substring(0, 20) + "...");
    const orderId = "ORD-01KWVB7T33TYF4QA9YD8AAQ2DQ";
    
    const newDate = new Date(Date.now() + 1000 * 60 * 60 * 24); 
    const res = await axios.post(`http://localhost:3001/api/orders/workflow/${orderId}/reschedule`, {
      rescheduledFor: newDate.toISOString()
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("SUCCESS:", res.data);
  } catch (err) {
    console.error("API ERROR:", err.response?.status, err.response?.data);
  } finally {
    await mongoose.disconnect();
  }
}
run();
