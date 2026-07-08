import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://veenolexharbal_db_user:mMcgJcIKMhZhzSr5@cluster0.srtooj0.mongodb.net/zoogno?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const admin = await db.collection('admins').findOne({});
    if (admin) {
      console.log("Admin email/username:", admin.email || admin.phone || admin.username || "No email field");
      console.log("Admin raw document fields:", Object.keys(admin));
      console.log("Admin details:", JSON.stringify(admin, null, 2));
    } else {
      console.log("No admins found in the collection!");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
