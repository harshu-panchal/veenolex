import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function testPayment() {
  await mongoose.connect(process.env.MONGO_URI);
  const paymentService = (await import('./app/services/paymentService.js'));
  try {
    const result = await paymentService.createPaymentOrderForOrderRef({
      orderRef: 'ORD-01KWS5ZTGH9HFNWHMNE5Q12RWM',
      userId: '6a0d8357680843ff39ba5abd'
    });
    console.log("Success:", result);
  } catch(e) {
    console.error("Payment Gateway Failed:");
    console.error(e.message);
    if(e.response) {
      console.error(e.response.data);
    }
  }
  process.exit(0);
}
testPayment();
