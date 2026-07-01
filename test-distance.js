// Check if location is saved
const userLocation = { latitude: 22.714622195103665, longitude: 75.89116823205774 }; // Dummy from earlier

// Check seller coordinates
const seller = {
  latitude: 22.7196,
  longitude: 75.8577,
  serviceRadius: 5
};

// Manual distance calculation
const R = 6371;
const dLat = (userLocation.latitude - seller.latitude) * Math.PI / 180;
const dLng = (userLocation.longitude - seller.longitude) * Math.PI / 180;
const a = 
  Math.sin(dLat/2) * Math.sin(dLat/2) +
  Math.cos(seller.latitude * Math.PI / 180) * Math.cos(userLocation.latitude * Math.PI / 180) *
  Math.sin(dLng/2) * Math.sin(dLng/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
const distance = R * c;

console.log("Distance:", distance.toFixed(2), "KM");
console.log("Service Radius:", seller.serviceRadius, "KM");
console.log("Is In Zone:", distance < seller.serviceRadius);
