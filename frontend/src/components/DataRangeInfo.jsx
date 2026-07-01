import React from "react";

export const DataRangeInfo = ({ dataAccess }) => {
  if (!dataAccess) return null;
  
  return (
    <div style={{
      backgroundColor: "#E3F2FD",
      padding: "10px 12px",
      borderRadius: "6px",
      marginBottom: "16px",
      fontSize: "12px",
      color: "#1565C0",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }}>
      <span>ℹ️</span>
      <div>
        <strong>Data Range:</strong> {dataAccess.dataRange}
        {dataAccess.role === "seller" && (
          <span> • Showing last 40 days</span>
        )}
        {dataAccess.role === "admin" && (
          <span> • Showing all data</span>
        )}
      </div>
    </div>
  );
};
