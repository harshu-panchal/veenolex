import mongoose from 'mongoose';
async function checkOtp() {
  await mongoose.connect('mongodb://localhost:27017/veenolex');
  const OrderOtp = (await import('./app/models/orderOtp.js')).default;
  const SellerProductRequest = (await import('./app/models/sellerProductRequest.js')).default;
  const request = await SellerProductRequest.findById('6a496201dd535d9aacbf8032');
  console.log('RequestNumber:', request.requestNumber);
  const otps = await OrderOtp.find({ orderId: request.requestNumber });
  console.log('OTPs:', otps);
  process.exit(0);
}
checkOtp().catch(console.error);
