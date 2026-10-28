/**
 * Shiprocket connectivity check.
 *
 * Confirms the credentials in backend/.env actually work against the live
 * Shiprocket API: logs in, then reads the channels and pickup locations the
 * order-creation flow depends on. Nothing is created or changed.
 *
 * Run:  node backend/scripts/checkShiprocket.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const API = "https://apiv2.shiprocket.in/v1/external";

const mask = (value) => {
  const str = String(value || "");
  if (!str) return "(empty)";
  return `${str.slice(0, 2)}${"*".repeat(Math.max(str.length - 4, 2))}${str.slice(-2)}`;
};

const ok = (msg) => console.log(`  PASS  ${msg}`);
const bad = (msg) => console.log(`  FAIL  ${msg}`);

const run = async () => {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  console.log("Shiprocket configuration");
  console.log(`  SHIPROCKET_EMAIL    : ${email || "(not set)"}`);
  console.log(`  SHIPROCKET_PASSWORD : ${mask(password)} (${password ? password.length : 0} chars)`);
  console.log(`  SHIPROCKET_CHANNEL_ID: ${process.env.SHIPROCKET_CHANNEL_ID || "(not set)"}`);
  console.log("");

  const placeholder =
    !email ||
    !password ||
    email === "your_shiprocket_email" ||
    password === "your_shiprocket_password";

  if (placeholder) {
    bad("Credentials are missing or still placeholders — the app treats Shiprocket as disabled.");
    process.exit(1);
  }

  // 1. Authenticate
  let token;
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      bad(`Login failed (HTTP ${res.status}): ${data?.message || JSON.stringify(data)}`);
      process.exit(1);
    }
    token = data.token;
    ok(`Login succeeded as ${data.email || email}${data.company_id ? ` (company ${data.company_id})` : ""}`);
  } catch (error) {
    bad(`Could not reach Shiprocket: ${error.message}`);
    process.exit(1);
  }

  const authed = (p) =>
    fetch(`${API}${p}`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });

  // 2. Channels — orders are created against one of these
  try {
    const res = await authed("/channels");
    const data = await res.json().catch(() => ({}));
    const channels = data?.data || [];
    if (!res.ok) {
      bad(`Channels request failed (HTTP ${res.status}): ${data?.message || ""}`);
    } else if (!channels.length) {
      bad("No channels configured on the Shiprocket account.");
    } else {
      ok(`${channels.length} channel(s): ${channels.map((c) => `${c.name} (id ${c.id})`).join(", ")}`);
    }
  } catch (error) {
    bad(`Channels request error: ${error.message}`);
  }

  // 3. Pickup locations — order creation sends pickup_location by name
  let pickupPincode = "";
  try {
    const res = await authed("/settings/company/pickup");
    const data = await res.json().catch(() => ({}));
    const list = data?.data?.shipping_address || [];
    if (!res.ok) {
      bad(`Pickup locations request failed (HTTP ${res.status}): ${data?.message || ""}`);
    } else if (!list.length) {
      bad("No pickup location configured — order creation will be rejected by Shiprocket.");
    } else {
      const primary = list.find((l) => l.is_primary_location === 1) || list[0];
      pickupPincode = String(primary?.pin_code || primary?.pincode || "");
      ok(
        `${list.length} pickup location(s): ${list
          .map((l) => `${l.pickup_location}${l.city ? ` — ${l.city}` : ""}`)
          .join(", ")} | orders will use "${primary?.pickup_location}"${
          pickupPincode ? ` (${pickupPincode})` : ""
        }`,
      );
    }
  } catch (error) {
    bad(`Pickup locations request error: ${error.message}`);
  }

  // 4. Serviceability — proves the account can actually quote a shipment.
  //    Pass --to=<6-digit pincode> to check a specific destination.
  const toArg = process.argv.find((a) => a.startsWith("--to="));
  const destination = (toArg ? toArg.slice(5) : "") || pickupPincode;
  if (!pickupPincode) {
    bad("Skipping serviceability check: no pickup pincode available.");
  } else {
    try {
      const qs = new URLSearchParams({
        pickup_postcode: pickupPincode,
        delivery_postcode: destination,
        weight: "0.5",
        cod: "0",
      });
      const res = await authed(`/courier/serviceability/?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      const couriers = data?.data?.available_courier_companies || [];
      if (!res.ok) {
        bad(`Serviceability ${pickupPincode} → ${destination} failed (HTTP ${res.status}): ${data?.message || ""}`);
      } else if (!couriers.length) {
        bad(`No courier serves ${pickupPincode} → ${destination}.`);
      } else {
        const cheapest = couriers.reduce((a, b) => (Number(a.rate) <= Number(b.rate) ? a : b));
        ok(
          `${couriers.length} courier(s) for ${pickupPincode} → ${destination}; cheapest ${cheapest.courier_name} at Rs.${cheapest.rate}`,
        );
      }
    } catch (error) {
      bad(`Serviceability request error: ${error.message}`);
    }
  }

  console.log("\nDone.");
};

run().catch((error) => {
  console.error("Check failed:", error);
  process.exit(1);
});
