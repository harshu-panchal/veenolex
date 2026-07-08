import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://veenolexharbal_db_user:mMcgJcIKMhZhzSr5@cluster0.srtooj0.mongodb.net/zoogno?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    // 1. Sellers
    const sellers = await db.collection('sellers').find({}).toArray();
    console.log("--- SELLERS ---");
    sellers.forEach(s => {
      console.log(`Seller ID: ${s._id}, Store Name: ${s.shopName}, Owner: ${s.ownerName}`);
    });

    // 2. Products count per seller
    console.log("\n--- PRODUCTS COUNT PER SELLER ---");
    const products = await db.collection('products').find({}).toArray();
    const productCountBySeller = {};
    products.forEach(p => {
      const sId = String(p.sellerId || p.seller || "master_catalog");
      productCountBySeller[sId] = (productCountBySeller[sId] || 0) + 1;
    });
    Object.entries(productCountBySeller).forEach(([sId, count]) => {
      console.log(`Seller ID / Owner: ${sId}, Count: ${count}`);
    });
    console.log("Total Products in DB:", products.length);

    // 3. Orders count per seller
    console.log("\n--- ORDERS COUNT PER SELLER ---");
    const orders = await db.collection('orders').find({}).toArray();
    const orderCountBySeller = {};
    orders.forEach(o => {
      const sId = String(o.seller || o.sellerId || "no_seller");
      orderCountBySeller[sId] = (orderCountBySeller[sId] || 0) + 1;
    });
    Object.entries(orderCountBySeller).forEach(([sId, count]) => {
      console.log(`Seller ID: ${sId}, Count: ${count}`);
    });
    console.log("Total Orders in DB:", orders.length);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
