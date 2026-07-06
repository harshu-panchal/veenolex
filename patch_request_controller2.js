const fs = require('fs');

const controllerPath = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/controller/sellerProductRequestController.js';
let content = fs.readFileSync(controllerPath, 'utf8');

const newFunctions = `
// ═══════════════════════════════════════════
// ADMIN: TRIGGER DELIVERY BROADCAST (FOR ALREADY APPROVED)
// ═══════════════════════════════════════════
export const triggerDeliveryBroadcast = async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await SellerProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: "Request must be approved first" });
    }

    if (request.deliveryBoy) {
      return res.status(400).json({ success: false, message: "Delivery boy is already assigned" });
    }

    await startRequestDeliverySearch(request._id);
    console.log("🚚 Delivery broadcast initiated for request:", request.requestNumber);

    return res.status(200).json({
      success: true,
      message: "Delivery broadcast started successfully",
      request
    });
  } catch (error) {
    console.error("❌ Error triggering delivery broadcast:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to trigger delivery broadcast"
    });
  }
};

// ═══════════════════════════════════════════
// ADMIN: MANUAL ASSIGN DELIVERY (FOR ALREADY APPROVED)
// ═══════════════════════════════════════════
export const manualAssignDelivery = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { deliveryBoyId } = req.body;

    if (!deliveryBoyId) {
      return res.status(400).json({ success: false, message: "deliveryBoyId is required" });
    }

    const request = await SellerProductRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: "Request must be approved first" });
    }

    request.deliveryBoy = deliveryBoyId;
    request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
    request.assignedAt = new Date();
    await request.save();

    console.log("🚚 Delivery boy manually assigned for request:", request.requestNumber);

    return res.status(200).json({
      success: true,
      message: "Delivery boy manually assigned",
      request
    });
  } catch (error) {
    console.error("❌ Error manually assigning delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign delivery boy manually"
    });
  }
};
`;

content += "\n" + newFunctions;
fs.writeFileSync(controllerPath, content);
console.log("Patched sellerProductRequestController.js");
