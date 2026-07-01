const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://veenolexharbal_db_user:mMcgJcIKMhZhzSr5@cluster0.srtooj0.mongodb.net/zoogno?retryWrites=true&w=majority&appName=Cluster0';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    
    let seller = await db.collection('sellers').findOne({});
    if (!seller) {
      seller = await db.collection('users').findOne({ role: 'seller' });
    }
    
    if (!seller) {
      console.log("No seller found. Creating dummy seller ID.");
      seller = { _id: new mongoose.Types.ObjectId() };
    } else {
      console.log("Using real seller ID:", seller._id);
    }
    
    const SELLER_ID = seller._id;

    // Today
    await db.collection('orders').insertOne({
      _id: new mongoose.Types.ObjectId(),
      seller: SELLER_ID,
      items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1, price: 500 }],
      pricing: { total: 500 },
      paymentStatus: "PAID",
      createdAt: new Date()
    });
    
    // 20 days ago
    await db.collection('orders').insertOne({
      _id: new mongoose.Types.ObjectId(),
      seller: SELLER_ID,
      items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1, price: 600 }],
      pricing: { total: 600 },
      paymentStatus: "PAID",
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    });

    // 39 days ago
    await db.collection('orders').insertOne({
      _id: new mongoose.Types.ObjectId(),
      seller: SELLER_ID,
      items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1, price: 700 }],
      pricing: { total: 700 },
      paymentStatus: "PAID",
      createdAt: new Date(Date.now() - 39 * 24 * 60 * 60 * 1000)
    });

    // 50 days ago
    await db.collection('orders').insertOne({
      _id: new mongoose.Types.ObjectId(),
      seller: SELLER_ID,
      items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1, price: 800 }],
      pricing: { total: 800 },
      paymentStatus: "PAID",
      createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000)
    });

    // 100 days ago
    await db.collection('orders').insertOne({
      _id: new mongoose.Types.ObjectId(),
      seller: SELLER_ID,
      items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1, price: 900 }],
      pricing: { total: 900 },
      paymentStatus: "PAID",
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    });

    console.log("✅ Seeded test orders.");
    
    const orders = await db.collection('orders').find({ seller: SELLER_ID }).sort({ createdAt: -1 }).toArray();
    console.log(`Verified: Found ${orders.length} orders for this seller`);
    orders.forEach(o => {
      console.log(` - Order Date: ${o.createdAt.toISOString().split('T')[0]}, Total: ${o.pricing?.total}`);
    });
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
