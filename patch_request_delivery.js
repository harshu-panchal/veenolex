const fs = require('fs');

const servicePath = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/services/orderWorkflowService.js';
let content = fs.readFileSync(servicePath, 'utf8');

const newFunctions = `
import SellerProductRequest from "../models/sellerProductRequest.js";
import Admin from "../models/admin.js";

// --- SELLER REQUEST DELIVERY SEARCH ---

export async function startRequestDeliverySearch(requestId) {
  const request = await SellerProductRequest.findById(requestId).populate('sellerId');
  if (!request) throw new Error("Request not found");

  const now = new Date();
  const deliveryMs = DEFAULT_DELIVERY_TIMEOUT_MS();

  request.deliveryWorkflowStatus = WORKFLOW_STATUS.DELIVERY_SEARCH;
  request.deliverySearchExpiresAt = new Date(now.getTime() + deliveryMs);
  
  await request.save();

  // For Admin to Seller delivery, pickup is Admin warehouse, drop is Seller shop
  const admin = await Admin.findOne({ role: 'Admin' }); // Or pick the admin who approved
  const radius = admin?.serviceRadius ? admin.serviceRadius * 1000 : INITIAL_DELIVERY_RADIUS_M();

  await DeliveryAssignment.create({
    orderMongoId: request._id,
    sourceId: request._id,
    sourceType: "SELLER_REQUEST",
    orderId: request.requestNumber,
    status: "broadcasting",
    radiusMeters: radius,
    attempt: 1,
    expiresAt: request.deliverySearchExpiresAt,
  });

  const payload = {
    orderId: request.requestNumber,
    sourceType: "SELLER_REQUEST",
    workflowStatus: WORKFLOW_STATUS.DELIVERY_SEARCH,
    radiusMeters: radius,
    preview: {
      pickup: "Veenolex Wholesale Warehouse",
      drop: request.sellerName || "Seller Store",
      total: request.totalAmount || 0,
    },
    deliverySearchExpiresAt: request.deliverySearchExpiresAt,
  };

  // Note: For actual admin-to-seller delivery broadcasts, we might want to emit to drivers near Admin warehouse.
  // We can reuse emitDeliveryBroadcastForSeller but use admin's location if available.
  // For now, let's assume emitDeliveryBroadcastForSeller finds nearby riders.
  await emitDeliveryBroadcastForSeller(
    admin ? admin._id : null,
    payload
  );

  return request;
}
`;

content = content.replace(
  'import Order from "../models/order.js";',
  'import Order from "../models/order.js";\nimport SellerProductRequest from "../models/sellerProductRequest.js";\nimport Admin from "../models/admin.js";'
);

// We don't want duplicate imports
content = content.replace('import SellerProductRequest from "../models/sellerProductRequest.js";\nimport Admin from "../models/admin.js";\n\n// --- SELLER REQUEST DELIVERY SEARCH ---', '// --- SELLER REQUEST DELIVERY SEARCH ---');

fs.writeFileSync(servicePath, content + "\n" + newFunctions);
console.log("Added startRequestDeliverySearch");
