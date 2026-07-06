import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function testHandoff() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/veenolex');
  
  const SellerProductRequest = (await import('./app/models/sellerProductRequest.js')).default;
  const { verifyHandoffOtpAndDeliver } = await import('./app/services/orderWorkflowService.js');
  
  // Find ANY request
  const request = await SellerProductRequest.findOne({ status: { $ne: 'DELIVERED' } });
  if (!request) {
    console.log('No non-delivered request found. Cannot test.');
    process.exit(0);
  }
  request.status = 'DISPATCHED';
  await request.save();
  console.log('Marked request as DISPATCHED:', request.requestNumber);
  
  // Fake OTP validation location
  const validationLocation = { lat: 20.0, lng: 75.0 };
  
  try {
    console.log('Calling verifyHandoffOtpAndDeliver...');
    const result = await verifyHandoffOtpAndDeliver(request.requestNumber, true, validationLocation);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error during handoff:', error);
  }
  
  process.exit(0);
}

testHandoff().catch(console.error);
