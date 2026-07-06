const fs = require('fs');

const emitterPath = '/Users/prathmesh/Documents/GitHub/veenolex/backend/app/services/orderSocketEmitter.js';
let content = fs.readFileSync(emitterPath, 'utf8');

// Add import if needed
if (!content.includes('getDeliveryPartnerIdsWithinRadius')) {
    content = content.replace(
        'getDeliveryPartnerIdsWithinCustomerRadius\n} from "./deliveryNearbyService.js";',
        'getDeliveryPartnerIdsWithinCustomerRadius,\n  getDeliveryPartnerIdsWithinRadius\n} from "./deliveryNearbyService.js";'
    );
}

const newMethod = `
export async function emitDeliveryBroadcastForLocation(location, radiusKm, payload) {
  const s = getIo();
  if (!location) return;

  const ids = await getDeliveryPartnerIdsWithinRadius(location.lat, location.lng, radiusKm);
  if (!ids.length) {
    if (process.env.NODE_ENV !== "production" && s) {
      s.to("delivery:online").emit("delivery:broadcast", {
        ...payload,
        at: new Date().toISOString(),
        _devFallback: true,
      });
    }
    return;
  }

  const body = { ...payload, at: new Date().toISOString() };

  if (s) {
    for (const id of ids) {
      s.to(\`delivery:\${id}\`).emit("delivery:broadcast", body);
    }
  }

  // Push notifications
  try {
    const fcmTokens = await Delivery.find({ _id: { $in: ids } })
      .select("fcmToken")
      .lean();
    
    const tokens = fcmTokens.map((d) => d.fcmToken).filter(Boolean);
    if (tokens.length > 0) {
      const messages = tokens.map(token => ({
        token,
        notification: {
          title: "New Delivery Request",
          body: \`Pickup from \${payload.preview?.pickup || "Store"}\`,
        },
        data: {
          event: "delivery:broadcast",
          payload: JSON.stringify(body),
        }
      }));
      emitNotificationEvent(NOTIFICATION_EVENTS.BULK_PUSH, { messages });
    }
  } catch (err) {
    console.warn("[emitDeliveryBroadcastForLocation] DB error", err.message);
  }
}
`;

content = content + "\n" + newMethod;
fs.writeFileSync(emitterPath, content);
console.log("Patched orderSocketEmitter.js");
