import mongoose from 'mongoose';
import { getOrderRoute } from './app/controller/orderWorkflowController.js';
import dotenv from '@dotenvx/dotenvx';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const req = {
    params: { orderId: 'REQ-2026-0040' },
    query: { phase: 'delivery', originLat: '22.7174', originLng: '75.8717' }
  };
  const res = {
    status: (code) => {
      console.log('Status:', code);
      return {
        json: (data) => console.log('JSON:', data)
      };
    }
  };
  
  try {
    await getOrderRoute(req, res);
  } catch (e) {
    console.error('CRASH:', e);
  }
  
  process.exit(0);
}

test();
