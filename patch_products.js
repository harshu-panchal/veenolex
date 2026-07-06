const fs = require('fs');

const productControllerPath = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/controller/productController.js';
let content = fs.readFileSync(productControllerPath, 'utf8');

if (!content.includes('import SellerInventory from "../models/sellerInventory.js";')) {
    content = content.replace(
        'import Product from "../models/product.js";',
        'import Product from "../models/product.js";\nimport SellerInventory from "../models/sellerInventory.js";'
    );
}

const originalSellerLogic = 'if (sellerId) query.sellerId = sellerId;';
const newSellerLogic = `if (sellerId) {
      const inventoryItems = await SellerInventory.find({ sellerId }).select('productId').lean();
      const masterProductIds = inventoryItems.map(item => item.productId);
      
      query.$or = [
        { sellerId: sellerId },
        { _id: { $in: masterProductIds } }
      ];
    }`;

content = content.replace(originalSellerLogic, newSellerLogic);
fs.writeFileSync(productControllerPath, content);
console.log("Patched productController.js");
