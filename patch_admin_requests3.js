const fs = require('fs');
const file = '/Users/prathmesh/Documents/GitHub/veenolex/frontend/src/modules/admin/pages/SellerProductRequests.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace(
    '  rejectRequest,',
    '  rejectRequest,\n  triggerDeliveryBroadcast,\n  manualAssignDelivery,'
);

// 2. Add handlers
const oldRejectModal = '  const [showRejectModal, setShowRejectModal] = useState(null);';
const newRejectModal = `  const [showRejectModal, setShowRejectModal] = useState(null);
  
  const handleTriggerBroadcast = async (requestId) => {
    try {
      setActionLoading(requestId + "_broadcast");
      await triggerDeliveryBroadcast(requestId);
      toast.success("Delivery Broadcast started!");
      
      setRequests(requests.map(r => 
        r._id === requestId ? { ...r, deliveryWorkflowStatus: "DELIVERY_SEARCH" } : r
      ));
    } catch (err) {
      toast.error("Failed to trigger broadcast: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualAssign = async (requestId) => {
    const deliveryBoyId = prompt("Enter Delivery Boy ID:");
    if (!deliveryBoyId) return;

    try {
      setActionLoading(requestId + "_assign");
      await manualAssignDelivery(requestId, deliveryBoyId);
      toast.success("Delivery boy assigned successfully!");
      
      setRequests(requests.map(r => 
        r._id === requestId ? { ...r, deliveryBoy: deliveryBoyId, deliveryWorkflowStatus: "DELIVERY_ASSIGNED" } : r
      ));
    } catch (err) {
      toast.error("Failed to assign delivery: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };
`;
content = content.replace(oldRejectModal, newRejectModal);

// 3. Add UI buttons
const oldPendingDiv = `{request.status === "PENDING" && (`;
const newPendingDiv = `
              {request.status === "APPROVED" && !request.deliveryBoy && (!request.deliveryWorkflowStatus || request.deliveryWorkflowStatus === "PENDING") && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => handleTriggerBroadcast(request._id)}
                    disabled={actionLoading === request._id + "_broadcast"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#3498DB",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_broadcast" ? "..." : "📡 Broadcast"}
                  </button>
                  <button
                    onClick={() => handleManualAssign(request._id)}
                    disabled={actionLoading === request._id + "_assign"}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#F39C12",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {actionLoading === request._id + "_assign" ? "..." : "👤 Manual Assigned"}
                  </button>
                </div>
              )}
              {request.status === "PENDING" && (`;
content = content.replace(oldPendingDiv, newPendingDiv);

fs.writeFileSync(file, content);
console.log("Patched SellerProductRequests.jsx");
