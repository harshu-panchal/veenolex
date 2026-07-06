import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGO_URI);

const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));

async function run() {
  const user = await User.findOne({});
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
  
  const product = await Product.findOne({ status: "active" });

  const payload = {
    items: [{
      product: product._id.toString(),
      name: product.name,
      quantity: 1,
      price: product.price || 10
    }],
    address: {
      location: { lat: 22.7196, lng: 75.8577 },
      address: "Test Address"
    }
  };

  const res = await fetch("http://localhost:3001/api/orders/checkout/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", data);
  mongoose.disconnect();
}
run();
