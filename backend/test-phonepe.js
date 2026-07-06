import { getActivePaymentProvider } from "./app/services/payment/providerRegistry.js";
import 'dotenv/config';
async function test() {
  try {
    const provider = getActivePaymentProvider();
    const res = await provider.initiatePayment({
      merchantOrderId: "TEST-REQ-" + Date.now(),
      amountPaise: 10000,
      redirectUrl: "http://localhost:5175/seller/orders"
    });
    console.log("Success:", res);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
