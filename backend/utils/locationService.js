export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const isUserInServiceZone = (userLocation, seller) => {
  if (!userLocation || !userLocation.lat || !userLocation.lng) return false;
  
  let slat, slng;
  if (seller && seller.location) {
    if (seller.location.lat && seller.location.lng) {
      slat = seller.location.lat;
      slng = seller.location.lng;
    } else if (Array.isArray(seller.location.coordinates) && seller.location.coordinates.length >= 2) {
      slng = seller.location.coordinates[0];
      slat = seller.location.coordinates[1];
    }
  }

  if (typeof slat !== "number" || typeof slng !== "number") return false;

  const distance = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    slat,
    slng
  );

  // Default to 5km if serviceRadius isn't defined on the seller document
  const serviceRadius = seller.serviceRadius || 5; 
  
  return distance <= serviceRadius;
};

export const checkProductAvailability = (product, userLocation) => {
  // We assume product.seller contains the populated seller object
  const seller = product.seller || product.sellerId;
  
  const inZone = isUserInServiceZone(userLocation, seller);

  if (inZone) {
    return {
      available: true,
      deliveryType: "SELLER_DIRECT"
    };
  }

  // If not in service zone, check if out-of-zone delivery is permitted
  if (product.zoneOutDeliveryEnabled) {
    return {
      available: true,
      deliveryType: "SHIPROCKET",
      shippingPartner: product.shippingPartner || "SHIPROCKET",
      zoneOutPrice: product.zoneOutPrice || 0
    };
  }

  return {
    available: false,
    deliveryType: null
  };
};
