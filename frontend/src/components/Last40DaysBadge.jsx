import React from "react";

export const Last40DaysBadge = () => {
  const fortyDaysAgo = new Date();
  fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
  
  const today = new Date();
  
  const formatDate = (date) => {
    return date.toLocaleDateString("en-IN", { 
      day: "numeric", 
      month: "short", 
      year: "numeric" 
    });
  };
  
  return (
    <div style={{
      backgroundColor: "#FFF3E0",
      border: "1px solid #FFE0B2",
      borderRadius: "8px",
      padding: "12px 16px",
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      gap: "12px"
    }}>
      
      <div style={{
        fontSize: "20px"
      }}>
        📅
      </div>
      
      <div style={{
        flex: 1
      }}>
        <p style={{
          fontSize: "13px",
          fontWeight: "600",
          color: "#E65100",
          margin: "0 0 4px"
        }}>
          Viewing Last 40 Days Data
        </p>
        <p style={{
          fontSize: "12px",
          color: "#FF7A00",
          margin: "0"
        }}>
          From {formatDate(fortyDaysAgo)} to {formatDate(today)}
        </p>
      </div>
      
      <div style={{
        backgroundColor: "#FF7A00",
        color: "white",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "600",
        whiteSpace: "nowrap"
      }}>
        Last 40 Days
      </div>
      
    </div>
  );
};
