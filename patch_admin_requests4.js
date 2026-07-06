const fs = require('fs');
const file = '/Users/prathmesh/Documents/GitHub/veenolex/frontend/src/modules/admin/pages/SellerProductRequests.jsx';
let content = fs.readFileSync(file, 'utf8');

// Ensure adminApi import
if (!content.includes('import adminApi')) {
    content = content.replace(
        'import React, { useState, useEffect } from "react";',
        'import React, { useState, useEffect } from "react";\nimport adminApi from "../../../services/adminApi";'
    );
}

// Update local states and Modal fetching
const oldManualAssign = `  const handleManualAssign = async (requestId) => {
    const deliveryBoyId = prompt("Enter Delivery Boy ID:");
    if (!deliveryBoyId) return;

    try {`;

const newManualAssign = `  const [showDriverModal, setShowDriverModal] = useState(null); // stores requestId
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [isFetchingDrivers, setIsFetchingDrivers] = useState(false);

  const openDriverModal = async (requestId) => {
    setShowDriverModal(requestId);
    setIsFetchingDrivers(true);
    try {
      const response = await adminApi.getDeliveryPartners({ status: 'active', limit: 100 });
      const payload = response.data.result || {};
      const data = Array.isArray(payload.items) ? payload.items : (response.data.results || response.data.result || []);
      setAvailableDrivers(data);
    } catch (err) {
      toast.error("Failed to fetch drivers: " + err.message);
    } finally {
      setIsFetchingDrivers(false);
    }
  };

  const handleManualAssign = async (requestId, deliveryBoyId) => {
    if (!deliveryBoyId) return;

    try {`;

content = content.replace(oldManualAssign, newManualAssign);

// Update button onClick
const oldButton = `onClick={() => handleManualAssign(request._id)}
                    disabled={actionLoading === request._id + "_assign"}`;
const newButton = `onClick={() => openDriverModal(request._id)}
                    disabled={actionLoading === request._id + "_assign" || showDriverModal === request._id}`;
content = content.replace(oldButton, newButton);


// Add Driver Modal JSX at the end of the return statement before the last div wrapper
const driverModalJSX = `
      {/* DRIVER PICKER MODAL */}
      {showDriverModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center",
          alignItems: "center", zIndex: 9999
        }}>
          <div style={{
            backgroundColor: "#fff", padding: "24px", borderRadius: "12px",
            width: "500px", maxWidth: "90%", maxHeight: "80vh", overflowY: "auto"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px", color: "#2C3E50" }}>Select a Delivery Partner</h3>
            {isFetchingDrivers ? (
              <p>Fetching active drivers...</p>
            ) : availableDrivers.length === 0 ? (
              <p>No active verified drivers found.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {availableDrivers.map(driver => (
                  <div key={driver._id || driver.id} style={{
                    padding: "12px", border: "1px solid #eee", borderRadius: "8px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <h4 style={{ margin: "0 0 4px 0" }}>{driver.name || "Unknown"}</h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "#7F8C8D" }}>
                        {driver.vehicleDetails?.vehicleType || "Vehicle"} • {driver.phone || "No Phone"}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: driver.isOnline ? "#27AE60" : "#E74C3C" }}>
                        {driver.isOnline ? "● Online" : "○ Offline"} {driver.isVerified && " (Verified)"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleManualAssign(showDriverModal, driver._id || driver.id);
                        setShowDriverModal(null);
                      }}
                      style={{
                        padding: "6px 12px", backgroundColor: "#F39C12",
                        color: "#fff", border: "none", borderRadius: "4px",
                        cursor: "pointer", fontWeight: "bold"
                      }}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button 
                onClick={() => setShowDriverModal(null)}
                style={{
                  padding: "8px 16px", backgroundColor: "#ECF0F1", color: "#34495E",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
`;

const lastDiv = `    </div>
  );
}`;
content = content.replace(lastDiv, driverModalJSX + lastDiv);

fs.writeFileSync(file, content);
console.log("Patched SellerProductRequests.jsx to add DriverPickerModal");
