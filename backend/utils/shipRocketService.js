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

export const getPickupLocation = async (token) => {
  if (cachedPickupLocation) return cachedPickupLocation;

  if (process.env.SHIPROCKET_PICKUP_LOCATION && process.env.SHIPROCKET_PICKUP_LOCATION !== "your_pickup_location") {
    cachedPickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;
    return cachedPickupLocation;
  }

  if (!token) return "work";

  try {
    const response = await fetch("https://apiv2.shiprocket.in/v1/external/settings/company/pickup", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    const addrs = data?.data?.shipping_address || [];
    if (addrs.length > 0) {
      const primary = addrs.find(a => a.is_primary_location === 1) || addrs[0];
      if (primary && primary.pickup_location) {
        cachedPickupLocation = primary.pickup_location;
        return cachedPickupLocation;
      }
    }
  } catch (err) {
    console.warn("Could not fetch Shiprocket pickup location dynamically:", err.message);
  }

  cachedPickupLocation = "work";
  return cachedPickupLocation;
};

let cachedPickupLocation = null;

export const createShipRocketOrder = async (order, user, userAddress, seller, items) => {
  try {
    const token = await getShiprocketToken();
    const channelId = await getChannelId(token);
    const pickupLocation = await getPickupLocation(token);

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
        pickup_location_id: pickupLocation,
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
    const pickupLocation = await getPickupLocation(token);

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

    const url = "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc";
    const now = new Date();
    const orderDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Map request items to ShipRocket adhoc format
    const orderItems = (items || []).map((item, idx) => ({
      name: item.productName || `Product-${idx + 1}`,
      sku: item.productId?.toString() || `SKU-${idx + 1}`,
      units: item.quantity || 1,
      selling_price: item.pricePerUnit || 0,
      discount: 0,
      tax: 0,
      hsn: 9999
    }));

    const sellerObj = seller || {};
    const sellerName = sellerObj.name || sellerObj.shopName || "Seller Customer";
    const rawPhone = (sellerObj.phone || "").replace(/[^0-9]/g, "");
    const sellerPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : "9876543210";
    const sellerEmail = sellerObj.email || "seller@veenolex.com";
    const sellerAddress = sellerObj.address || sellerObj.locality || "Warehouse Store";
    const sellerCity = sellerObj.city || "Indore";
    const sellerState = sellerObj.state || "Madhya Pradesh";
    const sellerPincode = sellerObj.pincode ? String(sellerObj.pincode).trim() : "452001";

    const payload = {
      order_id: request.requestNumber || `REQ-${request._id}`,
      order_date: orderDateStr,
      pickup_location: pickupLocation,
      channel_id: channelId || undefined,
      comment: "Veenolex Wholesale Product Delivery",
      billing_customer_name: sellerName,
      billing_last_name: "",
      billing_address: sellerAddress,
      billing_address_2: "",
      billing_city: sellerCity,
      billing_pincode: sellerPincode,
      billing_state: sellerState,
      billing_country: "India",
      billing_email: sellerEmail,
      billing_phone: sellerPhone,
      shipping_is_billing: true,
      order_items: orderItems,
      payment_method: "Prepaid",
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: request.totalAmount || 0,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5
    };

    console.log("🚀 Sending adhoc order to Shiprocket API:", payload.order_id, "Pickup:", pickupLocation);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("🚀 Shiprocket API order creation response:", JSON.stringify(data));

    if (!response.ok || (data.message && data.message.includes("Wrong Pickup location")) || (data.status_code === 0 && !data.order_id)) {
      console.error("ShipRocket API Error (Request):", data);
      throw new Error(data.message || (data.errors ? JSON.stringify(data.errors) : "Failed to create ShipRocket order for request"));
    }

    const shipRocketOrder = Array.isArray(data) ? data[0] : data;

    if (!shipRocketOrder || (!shipRocketOrder.order_id && !shipRocketOrder.id)) {
      throw new Error(data.message || "Shiprocket API returned no valid order ID");
    }

    request.shipRocketDetails = {
      orderId: shipRocketOrder.order_id?.toString() || shipRocketOrder.id?.toString(),
      shipmentId: shipRocketOrder.shipment_id?.toString() || null,
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
    request.shipRocketDetails = {
      orderId: `FAILED_SR_${request._id}`,
      trackingNumber: null,
      status: "SHIPMENT_FAILED",
      estimatedDelivery: null
    };
    if (typeof request.save === 'function') {
      await request.save();
    }
    throw error;
  }
};
