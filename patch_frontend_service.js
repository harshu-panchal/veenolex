const fs = require('fs');

const servicePath = '/Users/prathmesh/Documents/GitHub/veenolex/frontend/src/services/sellerProductRequestService.js';
let content = fs.readFileSync(servicePath, 'utf8');

const newFunctions = `
export const triggerDeliveryBroadcast = async (requestId) => {
  try {
    const response = await axiosInstance.patch(
      \`\${API_BASE}/admin/\${requestId}/trigger-delivery\`
    );
    return response.data;
  } catch (error) {
    console.error("❌ API Error triggering delivery broadcast:", error);
    throw error.response?.data || error;
  }
};

export const manualAssignDelivery = async (requestId, deliveryBoyId) => {
  try {
    const response = await axiosInstance.patch(
      \`\${API_BASE}/admin/\${requestId}/assign-delivery\`,
      { deliveryBoyId }
    );
    return response.data;
  } catch (error) {
    console.error("❌ API Error manually assigning delivery:", error);
    throw error.response?.data || error;
  }
};
`;

content += "\n" + newFunctions;
fs.writeFileSync(servicePath, content);
console.log("Patched frontend service");
