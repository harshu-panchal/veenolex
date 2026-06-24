import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function makeCouponsActive() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;
        
        console.log('Updating coupon expiration dates to 2030...');
        const result = await db.collection('coupons').updateMany(
            { code: { $in: ['SUMMER 01', 'SUMMER20'] } },
            { $set: { validTill: new Date('2030-12-31T23:59:59.999Z'), isActive: true } }
        );
        
        console.log(`Updated ${result.modifiedCount} coupons.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

makeCouponsActive();
