const fs = require('fs');
const file = '/Users/prathmesh/Documents/GitHub/veenolex/frontend/src/modules/admin/pages/SellerProductRequests.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { toast }')) {
    content = content.replace(
        'import React, { useState, useEffect } from "react";',
        'import React, { useState, useEffect } from "react";\nimport { toast } from "sonner";'
    );
}

content = content.replace(
    'alert("✅ Request approved successfully!");',
    'toast.success(startDelivery ? "Request approved and Delivery Broadcast started!" : "Request approved successfully!");'
);
content = content.replace(
    'alert("❌ Failed to approve: " + err.message);',
    'toast.error("Failed to approve: " + err.message);'
);

content = content.replace(
    'alert("❌ Request rejected!");',
    'toast.error("Request rejected!");'
);
content = content.replace(
    'alert("❌ Failed to reject: " + err.message);',
    'toast.error("Failed to reject: " + err.message);'
);

fs.writeFileSync(file, content);
console.log("Patched SellerProductRequests.jsx to use toast");
