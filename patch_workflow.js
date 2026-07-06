const fs = require('fs');
const file = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/services/orderWorkflowService.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'import { emitDeliveryBroadcastForSeller, retractDeliveryBroadcastForOrder } from "./orderSocketEmitter.js";',
    'import { emitDeliveryBroadcastForSeller, retractDeliveryBroadcastForOrder, emitDeliveryBroadcastForLocation } from "./orderSocketEmitter.js";'
);

const oldCall = `  await emitDeliveryBroadcastForSeller(
    admin ? admin._id : null,
    payload
  );`;

const newCall = `  if (admin && admin.location && admin.location.coordinates) {
    await emitDeliveryBroadcastForLocation(
      { lng: admin.location.coordinates[0], lat: admin.location.coordinates[1] },
      admin.serviceRadius || 5,
      payload
    );
  } else {
    console.warn("[startRequestDeliverySearch] Admin location not found. Broadcast might fail or use dev fallback.");
    await emitDeliveryBroadcastForSeller(admin ? admin._id : null, payload); // Fallback
  }`;

content = content.replace(oldCall, newCall);
fs.writeFileSync(file, content);
console.log("Patched orderWorkflowService.js");
