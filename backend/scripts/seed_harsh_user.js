import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB for seeding user...");

  const passwordHash = await bcrypt.hash("Admin!@#123", 10);

  const Admin = mongoose.model("Admin", new mongoose.Schema({}, { strict: false }));
  const Seller = mongoose.model("Seller", new mongoose.Schema({}, { strict: false }));
  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));

  // Admin
  let admin = await Admin.findOne({ email: "harsh@appzeto.com" });
  if (admin) {
    admin.password = passwordHash;
    admin.isVerified = true;
    await admin.save();
    console.log("Updated Admin: harsh@appzeto.com");
  } else {
    await Admin.create({
      name: "Harsh",
      email: "harsh@appzeto.com",
      password: passwordHash,
      role: "admin",
      isVerified: true
    });
    console.log("Created Admin: harsh@appzeto.com");
  }

  // Seller
  let seller = await Seller.findOne({ email: "harsh@appzeto.com" });
  if (seller) {
    seller.password = passwordHash;
    seller.isVerified = true;
    seller.isActive = true;
    seller.applicationStatus = "approved";
    await seller.save();
    console.log("Updated Seller: harsh@appzeto.com");
  } else {
    await Seller.create({
      name: "Harsh",
      email: "harsh@appzeto.com",
      password: passwordHash,
      role: "seller",
      shopName: "Harsh Store",
      phone: "9999999999",
      isVerified: true,
      isActive: true,
      applicationStatus: "approved"
    });
    console.log("Created Seller: harsh@appzeto.com");
  }

  // User
  let user = await User.findOne({ email: "harsh@appzeto.com" });
  if (user) {
    user.password = passwordHash;
    user.isVerified = true;
    await user.save();
    console.log("Updated User: harsh@appzeto.com");
  } else {
    await User.create({
      name: "Harsh",
      email: "harsh@appzeto.com",
      password: passwordHash,
      role: "admin",
      isVerified: true
    });
    console.log("Created User: harsh@appzeto.com");
  }

  await mongoose.disconnect();
}

run().catch(console.error);
