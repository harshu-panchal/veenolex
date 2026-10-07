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

const isShiprocketUnconfigured = () =>
  process.env.NODE_ENV === "development" ||
  !process.env.SHIPROCKET_EMAIL ||
  process.env.SHIPROCKET_EMAIL === "your_shiprocket_email";

function buildMockShipment() {
  return {
    orderId: `MOCK_SR_${Date.now()}`,
    shipmentId: null,
    trackingNumber: `MOCK_AWB_${Math.floor(100000000 + Math.random() * 900000000)}`,
    status: "NEW",
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function formatShiprocketDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tenDigitPhone(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

const SHIPROCKET_API = "https://apiv2.shiprocket.in/v1/external";

async function shiprocketRequest(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`${SHIPROCKET_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || `Shiprocket ${path} failed (${response.status})`);
    err.response = data;
    throw err;
  }
  return data;
}

/**
 * Parse a Shiprocket date ("Oct 02, 2026", "2026-10-02 23:59:59", ...).
 * Date-only values mean "during that day", so they are pinned to 8 PM.
 */
export function parseShiprocketDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const isoLike = /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$/.test(raw)
    ? raw.replace(" ", "T")
    : raw;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return null;
  const hasTime = /\d{1,2}:\d{2}/.test(raw);
  if (!hasTime) date.setHours(20, 0, 0, 0);
  return date;
}

/**
 * Couriers that can ship pickup → delivery pincode, with the courier
 * Shiprocket recommends and its expected delivery date.
 */
export async function checkShiprocketServiceability({ pickupPostcode, deliveryPostcode, weightKg = 0.5, cod = false }) {
  if (!/^[0-9]{6}$/.test(String(pickupPostcode || "")) || !/^[0-9]{6}$/.test(String(deliveryPostcode || ""))) {
    return null;
  }
  const token = await getShiprocketToken();
  if (!token) return null;

  const query = new URLSearchParams({
    pickup_postcode: String(pickupPostcode),
    delivery_postcode: String(deliveryPostcode),
    weight: String(weightKg || 0.5),
    cod: cod ? "1" : "0",
  });
  const data = await shiprocketRequest(token, `/courier/serviceability/?${query}`);
  const couriers = data?.data?.available_courier_companies || [];
  if (!couriers.length) return null;

  const recommendedId = data?.data?.recommended_courier_company_id;
  const courier =
    couriers.find((c) => Number(c.courier_company_id) === Number(recommendedId)) || couriers[0];
  const days = Number(courier.estimated_delivery_days);
  const etd =
    parseShiprocketDate(courier.etd) ||
    (Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null);

  return {
    courierCompanyId: Number(courier.courier_company_id),
    courierName: courier.courier_name || "",
    etd,
    estimatedDeliveryDays: Number.isFinite(days) ? days : null,
  };
}

async function assignAwbAndSchedulePickup(token, shipmentId, courierCompanyId) {
  const assigned = await shiprocketRequest(token, "/courier/assign/awb", {
    method: "POST",
    body: {
      shipment_id: String(shipmentId),
      ...(courierCompanyId ? { courier_id: String(courierCompanyId) } : {}),
    },
  });
  const awbData = assigned?.response?.data || {};
  if (!awbData.awb_code) {
    throw new Error(assigned?.message || "Shiprocket did not assign an AWB");
  }

  try {
    await shiprocketRequest(token, "/courier/generate/pickup", {
      method: "POST",
      body: { shipment_id: [String(shipmentId)] },
    });
  } catch (pickupErr) {
    // The shipment is booked; the pickup can be requested again from the
    // Shiprocket panel, so this is logged rather than failing the dispatch.
    console.warn(`Shiprocket pickup request failed for shipment ${shipmentId}:`, pickupErr.message);
  }

  return {
    awbCode: String(awbData.awb_code),
    courierCompanyId: Number(awbData.courier_company_id) || courierCompanyId || null,
    courierName: awbData.courier_name || "",
  };
}

/** Latest expected delivery date for an AWB (null when unknown). */
export async function fetchShiprocketTrackingEtd(awbCode) {
  if (!awbCode || String(awbCode).startsWith("MOCK_")) return null;
  const token = await getShiprocketToken();
  if (!token) return null;
  const data = await shiprocketRequest(token, `/courier/track/awb/${encodeURIComponent(awbCode)}`);
  const tracking = data?.tracking_data || {};
  const shipmentTrack = Array.isArray(tracking.shipment_track) ? tracking.shipment_track[0] : null;
  return parseShiprocketDate(tracking.etd || shipmentTrack?.edd);
}

/**
 * Create a Shiprocket (adhoc) order for a customer order.
 *
 * @param {Object} options.pickupLocation Shiprocket pickup nickname to ship
 *   from (e.g. the admin warehouse); defaults to the account's primary one.
 */
export const createShipRocketOrder = async (order, user, userAddress, seller, items, options = {}) => {
  const saveDetails = async (details) => {
    order.shipRocketDetails = details;
    if (typeof order.save === "function") {
      await order.save();
    }
    return details;
  };

  try {
    const token = await getShiprocketToken();

    if (!token) {
      if (isShiprocketUnconfigured()) {
        console.warn("Falling back to Mock ShipRocket order details (No valid ShipRocket credentials)");
        return saveDetails(buildMockShipment());
      }
      throw new Error("ShipRocket authentication failed. Please check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.");
    }

    const channelId = await getChannelId(token);
    const pickupLocation = options.pickupLocation || (await getPickupLocation(token));
    const address = userAddress || {};
    const customer = user || {};

    const pincode = String(address.pincode || "").trim();
    if (!/^[0-9]{6}$/.test(pincode)) {
      throw new Error("Delivery address has no valid 6-digit pincode; Shiprocket needs one to ship.");
    }

    const orderItems = (items || []).map((item, idx) => ({
      name: item.name || item.productName || `Product-${idx + 1}`,
      sku: String(item.sku || item.variantSlot || item.product?._id || item.product || `SKU-${idx + 1}`),
      units: Number(item.quantity || 1),
      selling_price: Number(item.price || 0),
      discount: 0,
      tax: 0,
      hsn: 9999,
    }));

    const [firstName, ...rest] = String(address.name || customer.name || "Customer").trim().split(/\s+/);
    const isCod = String(order.paymentMode || "").toUpperCase() === "COD";
    const subTotal = Number(order.paymentBreakdown?.grandTotal || order.pricing?.total || 0);
    // For COD, sub_total is what the courier collects: only the balance
    // left after any COD advance paid online.
    const codAdvancePaid =
      isCod && order.financeFlags?.codAdvanceCaptured ? Number(order.codAdvance?.amount || 0) : 0;

    const payload = {
      order_id: String(order.orderId || order._id),
      order_date: formatShiprocketDate(),
      pickup_location: pickupLocation,
      channel_id: channelId || undefined,
      billing_customer_name: firstName,
      billing_last_name: rest.join(" "),
      billing_address: address.address || address.street || "",
      billing_address_2: address.landmark || "",
      billing_city: address.city || "",
      billing_pincode: pincode,
      billing_state: address.state || "",
      billing_country: "India",
      billing_email: customer.email || "orders@veenolex.com",
      billing_phone: tenDigitPhone(address.phone || customer.phone),
      shipping_is_billing: true,
      order_items: orderItems,
      payment_method: isCod ? "COD" : "Prepaid",
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: Math.max(subTotal - codAdvancePaid, 0),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    const response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok || (data.status_code === 0 && !data.order_id)) {
      console.error("ShipRocket API Error:", data);
      throw new Error(data.message || (data.errors ? JSON.stringify(data.errors) : "Failed to create ShipRocket order"));
    }

    const shipRocketOrder = Array.isArray(data) ? data[0] : data;
    if (!shipRocketOrder || (!shipRocketOrder.order_id && !shipRocketOrder.id)) {
      throw new Error(data.message || "Shiprocket API returned no valid order ID");
    }

    const shipmentId = shipRocketOrder.shipment_id ? String(shipRocketOrder.shipment_id) : null;
    const details = {
      orderId: (shipRocketOrder.order_id || shipRocketOrder.id).toString(),
      shipmentId,
      trackingNumber: shipRocketOrder.awb_code || "AWB_PENDING",
      status: shipRocketOrder.status || "NEW",
      estimatedDelivery: null,
      etdCheckedAt: new Date(),
    };

    // Pick the recommended courier (and its delivery date), then book the
    // AWB and pickup so the parcel actually gets collected.
    let serviceability = null;
    try {
      serviceability = await checkShiprocketServiceability({
        pickupPostcode: options.pickupPostcode,
        deliveryPostcode: pincode,
        weightKg: options.weightKg,
        cod: isCod,
      });
    } catch (svcErr) {
      console.warn("Shiprocket serviceability check failed:", svcErr.message);
    }
    if (serviceability) {
      details.courierCompanyId = serviceability.courierCompanyId;
      details.courierName = serviceability.courierName;
      details.estimatedDelivery = serviceability.etd;
    }

    if (shipmentId && !shipRocketOrder.awb_code) {
      try {
        const awb = await assignAwbAndSchedulePickup(token, shipmentId, serviceability?.courierCompanyId);
        details.trackingNumber = awb.awbCode;
        details.courierCompanyId = awb.courierCompanyId || details.courierCompanyId;
        details.courierName = awb.courierName || details.courierName;
        details.status = "PICKUP_SCHEDULED";
      } catch (awbErr) {
        console.error(`Shiprocket AWB assignment failed for ${details.orderId}:`, awbErr.message);
        details.status = "AWB_PENDING";
      }
    }

    return saveDetails(details);
  } catch (error) {
    console.error("Error in createShipRocketOrder:", error.message);
    if (isShiprocketUnconfigured()) {
      console.warn("Falling back to Mock ShipRocket order details due to error in development");
      return saveDetails(buildMockShipment());
    }
    await saveDetails({
      orderId: `FAILED_SR_${order.orderId || order._id}`,
      trackingNumber: null,
      status: "SHIPMENT_FAILED",
      estimatedDelivery: null,
    });
    throw error;
  }
};

export const createShipRocketOrderForRequest = async (request, seller, items) => {
  try {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password || email === "your_shiprocket_email" || password === "your_shiprocket_password") {
      throw new Error("ShipRocket credentials missing. Please set your real SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in backend/.env to connect to app.shiprocket.in.");
    }

    const token = await getShiprocketToken();
    if (!token) {
      throw new Error("ShipRocket authentication failed. Please check your SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in backend/.env.");
    }

    const channelId = await getChannelId(token);
    const pickupLocation = await getPickupLocation(token);

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
    const sellerName = sellerObj.name || sellerObj.shopName || "Seller Store";
    const rawPhone = (sellerObj.phone || "").replace(/[^0-9]/g, "");
    const sellerPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : "9876543210";
    const sellerEmail = sellerObj.email || "seller@veenolex.com";
    const sellerAddress = sellerObj.address || sellerObj.locality || "Store Address";
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

    if (!response.ok || (data.message && data.message.toLowerCase().includes("wrong pickup location")) || (data.status_code === 0 && !data.order_id)) {
      console.error("ShipRocket API Error (Request):", data);
      const errMsg = data.message || (data.errors ? JSON.stringify(data.errors) : "Failed to create ShipRocket order for request");
      throw new Error(errMsg);
    }

    const shipRocketOrder = Array.isArray(data) ? data[0] : data;

    if (!shipRocketOrder || (!shipRocketOrder.order_id && !shipRocketOrder.id)) {
      throw new Error(data.message || "Shiprocket API returned no valid order ID");
    }

    request.deliveryType = "SHIPROCKET";
    request.deliveryWorkflowStatus = "DELIVERY_ASSIGNED";
    request.shipRocketDetails = {
      orderId: (shipRocketOrder.order_id || shipRocketOrder.id)?.toString(),
      shipmentId: (shipRocketOrder.shipment_id || shipRocketOrder.shipmentId)?.toString() || null,
      trackingNumber: shipRocketOrder.awb_code || "AWB_PENDING",
      status: shipRocketOrder.status || "NEW",
      estimatedDelivery: null,
      errorMessage: null
    };

    if (typeof request.save === 'function') {
      await request.save();
    }

    return request.shipRocketDetails;

  } catch (error) {
    console.error("❌ Error in createShipRocketOrderForRequest:", error.message);
    request.deliveryType = "SHIPROCKET";
    request.shipRocketDetails = {
      orderId: `FAILED_SR_${request._id}`,
      trackingNumber: null,
      status: "SHIPMENT_FAILED",
      estimatedDelivery: null,
      errorMessage: error.message
    };
    if (typeof request.save === 'function') {
      await request.save();
    }
    throw error;
  }
};
