const fs = require('fs');

const controllerPath = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/controller/sellerProductRequestController.js';
let content = fs.readFileSync(controllerPath, 'utf8');

content = content.replace(
  'import SellerInventory from "../models/sellerInventory.js";\nimport { getActivePaymentProvider }',
  'import SellerInventory from "../models/sellerInventory.js";\nimport { startRequestDeliverySearch } from "../services/orderWorkflowService.js";\nimport { getActivePaymentProvider }'
);

content = content.replace(
    'const { adminNote } = req.body;',
    'const { adminNote, startDelivery } = req.body;'
);

const approvalLogic = `    // ─────────────────────────────────────────────
    // NEW: START DELIVERY BROADCAST (IF REQUESTED)
    // ─────────────────────────────────────────────
    if (startDelivery) {
      await startRequestDeliverySearch(request._id);
      console.log("🚚 Delivery broadcast initiated for request:", request.requestNumber);
    }

    console.log("✅ Request approved:", request.requestNumber);`;

content = content.replace(
    '    console.log("✅ Request approved:", request.requestNumber);',
    approvalLogic
);

fs.writeFileSync(controllerPath, content);
console.log("Patched approveSellerRequest");
