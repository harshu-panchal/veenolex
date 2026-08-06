import dotenv from "dotenv";
dotenv.config();

import { getShiprocketToken, getChannelId } from "../utils/shipRocketService.js";

async function testShiprocketAuth() {
  console.log("==========================================");
  console.log("   SHIPROCKET LIVE AUTHENTICATION TEST    ");
  console.log("==========================================");
  console.log(`Using Email: ${process.env.SHIPROCKET_EMAIL || "NOT SET"}`);
  console.log(`Using Password: ${process.env.SHIPROCKET_PASSWORD ? "********" : "NOT SET"}`);

  console.log("\n1. Attempting login to Shiprocket API...");
  const token = await getShiprocketToken();

  if (!token) {
    console.error("❌ FAILED: Login failed or credentials are missing/invalid.");
    console.log("Please check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in backend/.env");
    process.exit(1);
  }

  console.log("✅ SUCCESS: Successfully authenticated with Shiprocket!");
  console.log(`Token (preview): ${token.substring(0, 20)}...`);

  console.log("\n2. Attempting to fetch Shiprocket Channel ID...");
  const channelId = await getChannelId(token);

  if (channelId) {
    console.log(`✅ SUCCESS: Found Channel ID: ${channelId}`);
  } else {
    console.log("⚠️ WARNING: Could not fetch Channel ID automatically. Default payload behavior will be used.");
  }

  console.log("\n==========================================");
  console.log("   TEST COMPLETE - CREDS ARE VALID! 🎉     ");
  console.log("==========================================");
  process.exit(0);
}

testShiprocketAuth();
