const fs = require('fs');
const file = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/services/orderWorkflowService.js';
let content = fs.readFileSync(file, 'utf8');

// Replace markArrivedAtStoreAtomic Request logic
content = content.replace(
  /if \(\!order \|\| order\.deliveryWorkflowStatus \!\=\= "DELIVERY_ASSIGNED"\) \{\n\s*const err \= new Error\("Invalid state: arrive at store first"\);\n\s*err\.statusCode \= 409;\n\s*throw err;\n\s*\}/,
  `if (!order || !["DELIVERY_ASSIGNED", "PICKUP_READY"].includes(order.deliveryWorkflowStatus)) {
      const err = new Error("Invalid state: arrive at store first");
      err.statusCode = 409;
      throw err;
    }
    if (order.deliveryWorkflowStatus === "PICKUP_READY") {
      return order;
    }`
);

// Replace markArrivedAtStoreAtomic Order logic
content = content.replace(
  /if \(\!order \|\| order\.workflowStatus \!\=\= WORKFLOW_STATUS\.DELIVERY_ASSIGNED\) \{\n\s*const err \= new Error\("Invalid state: arrive at store first"\);\n\s*err\.statusCode \= 409;\n\s*throw err;\n\s*\}/,
  `if (!order || ![WORKFLOW_STATUS.DELIVERY_ASSIGNED, WORKFLOW_STATUS.PICKUP_READY].includes(order.workflowStatus)) {
      const err = new Error("Invalid state: arrive at store first");
      err.statusCode = 409;
      throw err;
    }
    if (order.workflowStatus === WORKFLOW_STATUS.PICKUP_READY) {
      return order;
    }`
);

fs.writeFileSync(file, content);
console.log('markArrivedAtStoreAtomic updated');
