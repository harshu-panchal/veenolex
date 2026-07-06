const fs = require('fs');
const file = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/controller/sellerProductRequestController.js';
let content = fs.readFileSync(file, 'utf8');

// Ensure imports for manual assignment notifications
if (!content.includes('import { getIo } from "../socket.js";')) {
    content = content.replace(
        'import SellerInventory from "../models/sellerInventory.js";',
        'import SellerInventory from "../models/sellerInventory.js";\nimport { getIo } from "../socket.js";\nimport { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";\nimport { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";\nimport Notification from "../models/notification.js";\nimport Delivery from "../models/delivery.js";'
    );
}

const oldLogic = `    request.deliveryBoy = deliveryBoyId;
    request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
    request.assignedAt = new Date();
    await request.save();

    console.log("🚚 Delivery boy manually assigned for request:", request.requestNumber);`;

const newLogic = `    request.deliveryBoy = deliveryBoyId;
    request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
    request.assignedAt = new Date();
    await request.save();

    console.log("🚚 Delivery boy manually assigned for request:", request.requestNumber);

    try {
      const s = getIo();
      const payload = {
        orderId: request.requestNumber,
        sourceType: "SELLER_REQUEST",
        workflowStatus: "DELIVERY_ASSIGNED",
        preview: {
          pickup: "Veenolex Wholesale Warehouse",
          drop: request.sellerName || "Seller Store",
          total: request.totalAmount || 0,
        }
      };

      if (s) {
        s.to(\`delivery:\${deliveryBoyId}\`).emit("delivery:assigned", payload);
      }

      const deliveryPartner = await Delivery.findById(deliveryBoyId).select("fcmToken").lean();
      
      if (deliveryPartner?.fcmToken) {
        emitNotificationEvent(NOTIFICATION_EVENTS.BULK_PUSH, {
          messages: [{
            token: deliveryPartner.fcmToken,
            notification: {
              title: "New Delivery Assigned",
              body: \`You have been manually assigned to pickup from Veenolex Wholesale Warehouse\`,
            },
            data: {
              event: "delivery:assigned",
              payload: JSON.stringify(payload),
            }
          }]
        });
      }

      await Notification.create({
        recipientId: deliveryBoyId,
        recipientModel: "Delivery",
        title: "Delivery Assigned",
        message: \`You have been manually assigned to deliver \${request.requestNumber}\`,
        type: "order",
        metadata: { orderId: request.requestNumber, sourceType: "SELLER_REQUEST" },
      });
      
    } catch (err) {
      console.warn("❌ Failed to notify delivery boy on manual assign", err.message);
    }
`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content);
console.log("Patched sellerProductRequestController.js for notifications");
