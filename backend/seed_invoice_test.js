import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://veenolexharbal_db_user:mMcgJcIKMhZhzSr5@cluster0.srtooj0.mongodb.net/zoogno?retryWrites=true&w=majority&appName=Cluster0';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");
    const db = mongoose.connection.db;

    // 1. Find or create a seller
    let seller = await db.collection('sellers').findOne({ isVerified: true });
    if (!seller) {
      const sellerId = new mongoose.Types.ObjectId();
      await db.collection('sellers').insertOne({
        _id: sellerId,
        shopName: "TESTING SELLER STORE",
        ownerName: "John Doe",
        phone: "+91 98765 00000",
        email: "testing_seller@veenolex.com",
        address: "456, Wholesale Street, Sector 2",
        locationLabel: "Indore Wholesale Hub",
        isVerified: true,
        isActive: true,
        joinedAt: new Date()
      });
      seller = await db.collection('sellers').findOne({ _id: sellerId });
    }
    const SELLER_ID = seller._id;
    console.log("Using Seller ID:", SELLER_ID);

    // 2. Create products for this seller with slugs
    const prodId1 = new mongoose.Types.ObjectId();
    const prodId2 = new mongoose.Types.ObjectId();
    await db.collection('products').deleteMany({ sellerId: SELLER_ID });
    await db.collection('products').insertMany([
      {
        _id: prodId1,
        name: "Test Aloe Vera Gel",
        slug: "test-aloe-vera-gel-" + Date.now(),
        sellerId: SELLER_ID,
        stock: 50,
        price: 150,
        salePrice: 120,
        sku: "TEST-ALOE-01",
        createdAt: new Date()
      },
      {
        _id: prodId2,
        name: "Test Herbal Hair Oil",
        slug: "test-herbal-hair-oil-" + Date.now(),
        sellerId: SELLER_ID,
        variants: [
          { name: "100ml Bottle", stock: 30, salePrice: 200, sku: "TEST-OIL-100" },
          { name: "250ml Bottle", stock: 15, salePrice: 450, sku: "TEST-OIL-250" }
        ],
        createdAt: new Date()
      }
    ]);
    console.log("✅ Seeded 2 seller products with slugs.");

    // 3. Create a test order for this seller
    await db.collection('orders').deleteMany({ seller: SELLER_ID });
    await db.collection('orders').insertOne({
      _id: new mongoose.Types.ObjectId(),
      orderId: `ORD-${Date.now().toString().slice(-6)}`,
      seller: SELLER_ID,
      customer: { name: "Jane Test Customer", phone: "+91 90000 00000" },
      shippingAddress: { address: "Flat 101, Test Residency", city: "Indore", postalCode: "452001" },
      items: [
        { productId: prodId1, name: "Test Aloe Vera Gel", quantity: 2, price: 120 }
      ],
      pricing: {
        subtotal: 240,
        deliveryFee: 30,
        gst: 12,
        discount: 0,
        total: 282
      },
      payment: { method: "upi" },
      status: "delivered",
      createdAt: new Date()
    });
    console.log("✅ Seeded test order.");

    // 4. Create a delivered refill/restock request for this seller
    await db.collection('sellerproductrequests').deleteMany({ sellerId: SELLER_ID });
    await db.collection('sellerproductrequests').insertOne({
      _id: new mongoose.Types.ObjectId(),
      requestNumber: `REQ-${new Date().getFullYear()}-9999`,
      sellerId: SELLER_ID,
      sellerName: seller.shopName,
      sellerEmail: seller.email,
      sellerPhone: seller.phone,
      items: [
        {
          productId: prodId1,
          productName: "Test Aloe Vera Gel",
          pricePerUnit: 80, // Wholesale price
          quantity: 100,
          totalPrice: 8000
        }
      ],
      subtotal: 8000,
      tax: 400,
      totalAmount: 8400,
      paymentType: "PAY_AFTER_DELIVERY",
      paymentStatus: "PAID",
      status: "DELIVERED",
      createdAt: new Date()
    });
    console.log("✅ Seeded delivered refill request.");

  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Done.");
  }
}
seed();
