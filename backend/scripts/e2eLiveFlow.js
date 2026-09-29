/**
 * Live end-to-end run of the order flows against a RUNNING backend and its
 * database. It places real orders (and sends real notifications) for the
 * accounts below, so only point it at a dev/staging setup.
 *
 *   node scripts/e2eLiveFlow.js            # API at http://localhost:$PORT/api
 *   API_URL=http://host/api node scripts/e2eLiveFlow.js
 *
 * Scenarios:
 *   0. COD switched off  -> COD order rejected; switching it on reaches customers at once
 *   A. Local seller has stock -> seller accepts -> rider -> OTP -> delivered
 *   B. No local stock -> admin warehouse alert -> admin accepts -> rider -> delivered
 *   C. Seller never answers -> handed to the warehouse -> admin rejects -> refunded, stock back
 *   D. Customer cancels a pending order -> stock back
 * The COD setting is restored to what it was before the run.
 */
import "dotenv/config";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 7000}/api`;
const IDS = {
  customer: process.env.E2E_CUSTOMER_ID || "6a63025ba509cc1292c03e11",
  seller: process.env.E2E_SELLER_ID || "6999782fd49e8099e8a7b11c",
  admin: process.env.E2E_ADMIN_ID || "6999967401caf79cf76438a3",
  rider: process.env.E2E_RIDER_ID || "6999788ed49e8099e8a7b11f",
};
// Admin catalog products: [master id, variant sku]
const PRODUCTS = {
  localStock: ["6a71d397eb229c0f7acddbe8", "bodyl-001"], // BODY LOTION
  noLocalStock: ["6a71d115eb229c0f7acddae7", "hairo-001"], // HAIR OIL
  timeout: ["6a71d23deb229c0f7acddb8e", "shamp-001"], // SHAMPOO
};
const ADDRESS = {
  type: "Home",
  name: "E2E Test",
  address: "Kalani Nagar, Indore, Madhya Pradesh 452005, India",
  city: "Indore",
  state: "Madhya Pradesh",
  pincode: "452005",
  phone: "+919630938487",
  location: { lat: 22.7217907, lng: 75.8228899 },
};
const FORBIDDEN_CUSTOMER_FIELDS = ["shipRocketDetails", "deliveryType", "fulfilledBy", "routedReason", "routingHistory"];

const sign = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
const TOKENS = {
  customer: sign(IDS.customer, "customer"),
  seller: sign(IDS.seller, "seller"),
  admin: sign(IDS.admin, "admin"),
  delivery: sign(IDS.rider, "delivery"),
};

const results = [];
let failures = 0;
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  return ok;
}

async function call(role, method, path, body) {
  const started = performance.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(role ? { Authorization: `Bearer ${TOKENS[role]}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, ms: Math.round(performance.now() - started), text };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const oid = (id) => new mongoose.Types.ObjectId(id);

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
const db = mongoose.connection.db;
const Orders = db.collection("orders");
const Products = db.collection("products");

const getOrder = (orderId) => Orders.findOne({ orderId });
async function waitFor(orderId, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let order;
  while (Date.now() < deadline) {
    order = await getOrder(orderId);
    if (order && predicate(order)) return order;
    await sleep(3000);
  }
  throw new Error(`Timed out waiting for ${label} on ${orderId} (last: ${order?.workflowStatus}/${order?.fulfilledBy})`);
}

async function variantStock(productId, sku) {
  const p = await Products.findOne({ _id: oid(productId) }, { projection: { stock: 1, variants: 1 } });
  return { stock: p?.stock, variant: p?.variants?.find((v) => v.sku === sku)?.stock };
}
async function cloneOf(masterId) {
  return Products.findOne({ adminProductId: oid(masterId), sellerId: oid(IDS.seller) }, { projection: { _id: 1 } });
}
async function stockSnapshot() {
  const snap = {};
  for (const [key, [masterId, sku]] of Object.entries(PRODUCTS)) {
    const clone = await cloneOf(masterId);
    snap[key] = {
      master: await variantStock(masterId, sku),
      seller: clone ? await variantStock(String(clone._id), sku) : null,
    };
  }
  return snap;
}

async function placeOrder(key, paymentMode = "COD") {
  const [masterId, sku] = PRODUCTS[key];
  return call("customer", "POST", "/orders", {
    address: ADDRESS,
    paymentMode,
    items: [{ product: masterId, variantSku: sku, quantity: 1 }],
  });
}
const placedOrderId = (res) => {
  const r = res.json?.result || {};
  return r.order?.orderId || r.orders?.[0]?.orderId || r.orderId;
};

async function riderDelivers(orderId, pickupPoint) {
  const at = (point) => ({ lat: point.lat, lng: point.lng });
  let r = await call("delivery", "POST", `/orders/workflow/${orderId}/pickup/ready`, at(pickupPoint));
  check("rider arrives at pickup", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  r = await call("delivery", "POST", `/orders/workflow/${orderId}/pickup/confirm`, at(pickupPoint));
  check("rider confirms pickup", r.status === 200, `${r.status} ${r.json?.message || ""}`);

  const eta = (await getOrder(orderId))?.deliveryEta;
  check("customer ETA confirmed once out for delivery", eta?.confidence === "confirmed", JSON.stringify(eta?.confidence));

  r = await call("delivery", "POST", `/orders/workflow/${orderId}/otp/request`, at(ADDRESS.location));
  check("rider requests delivery OTP at the door", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  const otpRes = await call("customer", "GET", `/orders/workflow/${orderId}/otp/active`);
  const code = otpRes.json?.result?.otp || otpRes.json?.otp;
  check("customer can see the OTP", Boolean(code), `${otpRes.status}`);
  r = await call("delivery", "POST", `/orders/workflow/${orderId}/otp/verify`, { code, ...at(ADDRESS.location) });
  check("rider verifies OTP", r.status === 200, `${r.status} ${r.json?.message || ""}`);

  const delivered = await waitFor(orderId, (o) => o.workflowStatus === "DELIVERED", 20000, "DELIVERED");
  check("order delivered", delivered.workflowStatus === "DELIVERED");
  return delivered;
}

async function customerViewIsClean(orderId) {
  const r = await call("customer", "GET", `/orders/details/${orderId}`);
  const order = r.json?.result?.order || r.json?.result || {};
  const leaked = FORBIDDEN_CUSTOMER_FIELDS.filter((field) => field in order);
  check("customer order view shows no delivery method", r.status === 200 && leaked.length === 0,
    leaked.length ? `leaked: ${leaked.join(",")}` : `eta ${order.deliveryEta ? "present" : "missing"}`);
}

console.log(`API ${API}\n`);
const originalSettings = (await call("admin", "GET", "/admin/settings/delivery")).json?.result || {};
const before = await stockSnapshot();
const warehouse = (await call("admin", "GET", "/admin/fulfillment/warehouse")).json?.result?.resolved;
const seller = await db.collection("sellers").findOne({ _id: oid(IDS.seller) }, { projection: { location: 1 } });
const shop = { lng: seller.location.coordinates[0], lat: seller.location.coordinates[1] };

try {
  // ── 0. Payment methods ────────────────────────────────────────────────
  console.log("0. Payment methods");
  let r = await call("admin", "PUT", "/admin/settings/delivery", { codEnabled: false, onlineEnabled: true });
  check("admin switches COD off", r.status === 200, `${r.status}`);
  r = await call(null, "GET", "/settings");
  check("customers see COD off immediately", r.json?.result?.codEnabled === false);
  r = await placeOrder("localStock", "COD");
  check("COD order rejected while COD is off", r.status === 400 && /cash on delivery/i.test(r.json?.message || ""), `${r.status} ${r.json?.message}`);
  r = await call("admin", "PUT", "/admin/settings/delivery", { codEnabled: false, onlineEnabled: false });
  check("both methods off is refused", r.status === 400, `${r.status} ${r.json?.message}`);
  r = await call("admin", "PUT", "/admin/settings/delivery", { codEnabled: true });
  check("admin switches COD on", r.status === 200);
  r = await call(null, "GET", "/settings");
  check("customers see COD on immediately", r.json?.result?.codEnabled === true);

  // ── A. Local seller ───────────────────────────────────────────────────
  console.log("\nA. Local seller has stock");
  r = await call("customer", "POST", "/orders/checkout/preview", {
    address: ADDRESS, paymentMode: "COD",
    items: [{ product: PRODUCTS.localStock[0], variantSku: PRODUCTS.localStock[1], quantity: 1 }],
  });
  check("checkout preview returns a delivery time", r.status === 200 && Boolean(r.json?.result?.deliveryEstimate), `${r.status} ${r.ms}ms`);
  r = await placeOrder("localStock");
  const orderA = placedOrderId(r);
  check("order placed", r.status === 201 || r.status === 200, `${r.status} ${orderA} ${r.ms}ms`);
  let a = await getOrder(orderA);
  check("routed to the local seller", a?.fulfilledBy === "SELLER" && String(a.seller) === IDS.seller, `${a?.fulfilledBy} ${a?.routedReason}`);
  await customerViewIsClean(orderA);
  r = await call("seller", "GET", "/orders/seller-orders");
  check("seller sees the order", (r.json?.result?.items || []).some((o) => o.orderId === orderA));
  r = await call("seller", "PUT", `/orders/status/${orderA}`, { status: "confirmed" });
  check("seller accepts", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  r = await call("seller", "POST", `/orders/${orderA}/assign-delivery-boy`, { deliveryBoyId: IDS.rider });
  check("seller assigns the rider", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  await riderDelivers(orderA, shop);

  // ── B. Warehouse ──────────────────────────────────────────────────────
  console.log("\nB. No local stock -> admin warehouse");
  r = await placeOrder("noLocalStock");
  const orderB = placedOrderId(r);
  check("order placed", r.status === 201 || r.status === 200, `${r.status} ${orderB}`);
  let b = await getOrder(orderB);
  check("routed to the admin warehouse", b?.fulfilledBy === "ADMIN" && !b.seller, `${b?.fulfilledBy} ${b?.routedReason}`);
  await customerViewIsClean(orderB);
  r = await call("admin", "GET", "/admin/fulfillment/orders?tab=pending");
  check("order waits in admin's pending tab", (r.json?.result?.items || []).some((o) => o.orderId === orderB));
  const notes = await db.collection("notifications").countDocuments({ "data.orderId": orderB, recipientModel: "Admin" });
  check("admins got an in-app notification", notes > 0, `${notes}`);
  r = await call("admin", "POST", `/admin/fulfillment/orders/${orderB}/accept`);
  check("admin accepts", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  r = await call("admin", "POST", `/admin/fulfillment/orders/${orderB}/dispatch`, { mode: "MANUAL", deliveryBoyId: IDS.rider });
  check("admin dispatches with a rider", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  await riderDelivers(orderB, { lat: warehouse.lat, lng: warehouse.lng });

  // ── C. Seller timeout ─────────────────────────────────────────────────
  console.log("\nC. Seller does not answer -> warehouse");
  r = await placeOrder("timeout");
  const orderC = placedOrderId(r);
  let c = await getOrder(orderC);
  check("routed to the local seller first", c?.fulfilledBy === "SELLER", `${c?.fulfilledBy}`);
  const handedAt = Date.now();
  c = await waitFor(orderC, (o) => o.fulfilledBy === "ADMIN", 120000, "reroute to warehouse");
  check("handed to the warehouse after the seller's window", c.routedReason === "SELLER_TIMEOUT",
    `${c.routedReason} after ${Math.round((Date.now() - handedAt) / 1000)}s`);
  r = await call("admin", "POST", `/admin/fulfillment/orders/${orderC}/reject`, { reason: "E2E test" });
  check("admin rejects", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  c = await getOrder(orderC);
  check("order cancelled", c.workflowStatus === "CANCELLED");

  // ── D. Customer cancel ────────────────────────────────────────────────
  console.log("\nD. Customer cancels");
  r = await placeOrder("localStock");
  const orderD = placedOrderId(r);
  r = await call("customer", "PUT", `/orders/cancel/${orderD}`, { reason: "E2E test" });
  check("customer cancels a pending order", r.status === 200, `${r.status} ${r.json?.message || ""}`);
  const d = await getOrder(orderD);
  check("order cancelled", d?.workflowStatus === "CANCELLED" || d?.status === "cancelled", `${d?.workflowStatus}`);
} catch (error) {
  check("run completed", false, error.message);
} finally {
  const restore = {};
  if (typeof originalSettings.codEnabled === "boolean") restore.codEnabled = originalSettings.codEnabled;
  if (typeof originalSettings.onlineEnabled === "boolean") restore.onlineEnabled = originalSettings.onlineEnabled;
  const r = await call("admin", "PUT", "/admin/settings/delivery", restore);
  check("payment settings restored", r.status === 200, JSON.stringify(restore));

  // Net effect: A and B each sold one unit; C and D gave theirs back.
  await sleep(1500);
  const after = await stockSnapshot();
  const delta = (k, side) => (after[k][side]?.variant ?? 0) - (before[k][side]?.variant ?? 0);
  console.log("\nStock (variant) before -> after");
  for (const k of Object.keys(PRODUCTS)) {
    console.log(`  ${k.padEnd(12)} warehouse ${before[k].master.variant} -> ${after[k].master.variant}   seller ${before[k].seller?.variant} -> ${after[k].seller?.variant}`);
  }
  check("A sold one unit from the seller", delta("localStock", "seller") === -1, `${delta("localStock", "seller")}`);
  check("B sold one unit from the warehouse", delta("noLocalStock", "master") === -1, `${delta("noLocalStock", "master")}`);
  check("C returned its unit", delta("timeout", "seller") + delta("timeout", "master") === 0,
    `seller ${delta("timeout", "seller")}, warehouse ${delta("timeout", "master")}`);

  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  await mongoose.disconnect();
  process.exit(failures ? 1 : 0);
}
