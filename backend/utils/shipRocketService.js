let cachedToken = null;
let tokenExpiresAt = 0;
let cachedChannelId = null;

export const getShiprocketToken = async () => {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password || email === "your_shiprocket_email" || password === "your_shiprocket_password") {
    return null;
  }

  // Return cached token if valid (with 1-hour margin)
  if (cachedToken && Date.now() < tokenExpiresAt - 60 * 60 * 1000) {
    return cachedToken;
  }

  try {
    const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok || !data.token) {
      console.error("ShipRocket Authentication Error:", data);
      return null;
    }

    cachedToken = data.token;
    // Cache token for 9 days (Shiprocket tokens expire in 10 days)
    tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
    return cachedToken;
  } catch (error) {
    console.error("Failed to authenticate with ShipRocket:", error);
    return null;
  }
};

export const getChannelId = async (token) => {
  if (cachedChannelId) return cachedChannelId;

  // Fallback to process.env.SHIPROCKET_CHANNEL_ID if explicitly set
  if (process.env.SHIPROCKET_CHANNEL_ID && process.env.SHIPROCKET_CHANNEL_ID !== "your_channel_id") {
    cachedChannelId = process.env.SHIPROCKET_CHANNEL_ID;
    return cachedChannelId;
  }

  if (!token) return null;

  try {
    const response = await fetch("https://apiv2.shiprocket.in/v1/external/channels", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    const channels = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    if (channels.length > 0 && (channels[0].channel_id || channels[0].id)) {
      cachedChannelId = (channels[0].channel_id || channels[0].id).toString();
      return cachedChannelId;
    }
  } catch (error) {
    console.warn("Could not fetch ShipRocket channels dynamically:", error.message);
  }
  return null;
};

export const createShipRocketOrder = async (order, user, userAddress, seller, items) => {
  try {
    const token = await getShiprocketToken();
    const channelId = await getChannelId(token);

    if (!token) {
      if (
        process.env.NODE_ENV === "development" || 
        !process.env.SHIPROCKET_EMAIL || 
        process.env.SHIPROCKET_EMAIL === "your_shiprocket_email"
      ) {
        console.warn("Falling back to Mock ShipRocket order details (No valid ShipRocket credentials)");
        const mockDetails = {
          orderId: `MOCK_SR_${Date.now()}`,
          trackingNumber: `MOCK_AWB_${Math.floor(100000000 + Math.random() * 900000000)}`,
          status: "NEW",
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        };
        order.shipRocketDetails = mockDetails;
        if (typeof order.save === 'function') {
          await order.save();
        }
        return mockDetails;
      }
      throw new Error("ShipRocket authentication failed. Please check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.");
    }

    const url = "https://apiv2.shiprocket.in/v1/orders/create/bulk";
    
    // Map internal order items to ShipRocket format
    const orderItems = items.map(item => ({
      sku: item.product?.sku || item.sku || "UNKNOWN_SKU",
      hsn_code: "9999",
      quantity: item.quantity,
      price: item.price
    }));

    const payload = [
      {
        channel_id: channelId || undefined,
        order_id: order._id.toString(),
        order_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        pickup_location_id: seller.shipRocketPickupId || "Primary",
        billing_customer_name: user.name,
        billing_email: user.email,
        billing_phone: user.phone,
        billing_address: userAddress.street || userAddress.address,
        billing_city: userAddress.city,
        billing_state: userAddress.state || "Maharashtra", // Fallback state
        billing_pincode: userAddress.pincode || "000000",
        shipping_is_default: true,
        order_items: orderItems,
        payment_method: "PREPAID",
        sub_total: order.pricing?.total || order.total || 0
      }
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ShipRocket API Error:", data);
      if (
        process.env.NODE_ENV === "development" || 
        !process.env.SHIPROCKET_EMAIL || 
        process.env.SHIPROCKET_EMAIL === "your_shiprocket_email"
      ) {
        console.warn("Falling back to Mock ShipRocket order details for development environment");
        const mockDetails = {
          orderId: `MOCK_SR_${Date.now()}`,
          trackingNumber: `MOCK_AWB_${Math.floor(100000000 + Math.random() * 900000000)}`,
          status: "NEW",
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        };
        order.shipRocketDetails = mockDetails;
        if (typeof order.save === 'function') {
          await order.save();
        }
        return mockDetails;
      }
      throw new Error(data.message || "Failed to create ShipRocket order");
    }

    const shipRocketOrder = Array.isArray(data) ? data[0] : data;

    order.shipRocketDetails = {
      orderId: shipRocketOrder.order_id?.toString() || shipRocketOrder.id?.toString(),
      trackingNumber: shipRocketOrder.awb_code || null,
      status: shipRocketOrder.status || "NEW",
      estimatedDelivery: null
    };

    if (typeof order.save === 'function') {
      await order.save();
    }

    return order.shipRocketDetails;

  } catch (error) {
    console.error("Error in createShipRocketOrder:", error);
    if (
      process.env.NODE_ENV === "development" || 
      !process.env.SHIPROCKET_EMAIL || 
      process.env.SHIPROCKET_EMAIL === "your_shiprocket_email"
    ) {
      console.warn("Falling back to Mock ShipRocket order details due to error in development");
      const mockDetails = {
        orderId: `MOCK_SR_${Date.now()}`,
        trackingNumber: `MOCK_AWB_${Math.floor(100000000 + Math.random() * 900000000)}`,
        status: "NEW",
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      };
      order.shipRocketDetails = mockDetails;
      if (typeof order.save === 'function') {
        await order.save();
      }
      return mockDetails;
    }
    throw error;
  }
};

export const createShipRocketOrderForRequest = async (request, seller, items) => {
  try {
    const token = await getShiprocketToken();
    const channelId = await getChannelId(token);

    if (!token) {
      if (
        process.env.NODE_ENV === "development" || 
        !process.env.SHIPROCKET_EMAIL || 
        process.env.SHIPROCKET_EMAIL === "your_shiprocket_email"
      ) {
        console.warn("Falling back to Mock ShipRocket request details (No valid ShipRocket credentials)");
        const mockDetails = {
          orderId: `MOCK_SR_REQ_${Date.now()}`,
          trackingNumber: `MOCK_AWB_${Math.floor(100000000 + Math.random() * 900000000)}`,
          status: "NEW",
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        };
        request.shipRocketDetails = mockDetails;
        if (typeof request.save === 'function') {
          await request.save();
        }
        return mockDetails;
      }
      throw new Error("ShipRocket authentication failed. Please check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.");
    }

    const url = "https://apiv2.shiprocket.in/v1/orders/create/bulk";
    
    // Map request items to ShipRocket format
    const orderItems = items.map(item => ({
      sku: item.productId?.toString() || "UNKNOWN_SKU",
      hsn_code: "9999",
      quantity: item.quantity,
      price: item.pricePerUnit
    }));

    const payload = [
      {
        channel_id: channelId || undefined,
        order_id: request._id.toString(),
        order_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        pickup_location_id: "Primary", // Admin warehouse is the shipper
        billing_customer_name: seller.name,
        billing_email: seller.email,
        billing_phone: seller.phone,
        billing_address: seller.address || "Default Seller Address",
        billing_city: seller.city || "Default City",
        billing_state: seller.state || "Maharashtra", // Fallback state
        billing_pincode: seller.pincode || "000000",
        shipping_is_default: true,
        order_items: orderItems,
        payment_method: "PREPAID",
        sub_total: request.totalAmount || 0
      }
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ShipRocket API Error (Request):", data);
      if (
        process.env.NODE_ENV === "development" || 
        !process.env.SHIPROCKET_EMAIL || 
        process.env.SHIPROCKET_EMAIL === "your_shiprocket_email"
      ) {
        console.warn("Falling back to Mock ShipRocket request details for development environment");
        const mockDetails = {
          orderId: `MOCK_SR_REQ_${Date.now()}`,
          trackingNumber: `MOCK_AWB_${Math.floor(100000000 + Math.random() * 900000000)}`,
          status: "NEW",
          estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        };
        request.shipRocketDetails = mockDetails;
        if (typeof request.save === 'function') {
          await request.save();
        }
        return mockDetails;
      }
      throw new Error(data.message || "Failed to create ShipRocket order for request");
    }

    const shipRocketOrder = Array.isArray(data) ? data[0] : data;

    request.shipRocketDetails = {
      orderId: shipRocketOrder.order_id?.toString() || shipRocketOrder.id?.toString(),
      trackingNumber: shipRocketOrder.awb_code || null,
      status: shipRocketOrder.status || "NEW",
      estimatedDelivery: null
    };

    if (typeof request.save === 'function') {
      await request.save();
    }

    return request.shipRocketDetails;

  } catch (error) {
    console.error("Error in createShipRocketOrderForRequest:", error);
    if (
      process.env.NODE_ENV === "development" || 
      !process.env.SHIPROCKET_EMAIL || 
      process.env.SHIPROCKET_EMAIL === "your_shiprocket_email"
    ) {
      console.warn("Falling back to Mock ShipRocket details due to error in development");
      const mockDetails = {
        orderId: `MOCK_SR_REQ_${Date.now()}`,
        trackingNumber: `MOCK_AWB_${Math.floor(100000000 + Math.random() * 900000000)}`,
        status: "NEW",
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      };
      request.shipRocketDetails = mockDetails;
      if (typeof request.save === 'function') {
        await request.save();
      }
      return mockDetails;
    }
    throw error;
  }
};
