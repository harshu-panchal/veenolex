const fs = require('fs');

const routePath = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/routes/sellerProductRequestRoutes.js';
let content = fs.readFileSync(routePath, 'utf8');

if (!content.includes('triggerDeliveryBroadcast')) {
    content = content.replace(
        'rejectSellerRequest\n} from "../controller/sellerProductRequestController.js";',
        'rejectSellerRequest,\n  triggerDeliveryBroadcast,\n  manualAssignDelivery\n} from "../controller/sellerProductRequestController.js";'
    );

    content += `

// PATCH /api/seller-requests/admin/:requestId/trigger-delivery
router.patch(
  "/admin/:requestId/trigger-delivery",
  verifyToken,
  allowRoles("admin"),
  triggerDeliveryBroadcast
);

// PATCH /api/seller-requests/admin/:requestId/assign-delivery
router.patch(
  "/admin/:requestId/assign-delivery",
  verifyToken,
  allowRoles("admin"),
  manualAssignDelivery
);
`;
    fs.writeFileSync(routePath, content);
    console.log("Patched sellerProductRequestRoutes.js");
} else {
    console.log("Already patched");
}
