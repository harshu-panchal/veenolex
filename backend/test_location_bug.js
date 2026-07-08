import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { updateDeliveryLocation } from './app/controller/deliveryController.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const req = {
      user: { id: '6a4e27278bbc054df7c376cc' },
      body: {
        lat: 22.7175,
        lng: 75.8717,
        orderId: 'ORD1771781774451898'
      }
    };
    const res = {
      status(code) {
        console.log('RES STATUS:', code);
        return this;
      },
      json(data) {
        console.log('RES JSON:', JSON.stringify(data, null, 2));
        return this;
      }
    };

    console.log('Calling updateDeliveryLocation...');
    await updateDeliveryLocation(req, res);
  } catch (err) {
    console.error('CRASH OUTSIDE:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
