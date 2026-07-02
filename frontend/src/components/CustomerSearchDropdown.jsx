import React, { useState, useEffect, useRef } from "react";
import { fetchCustomersForDropdown, formatCustomerForDropdown } from "../services/adminCustomerService";

export const CustomerSearchDropdown = ({ onSelect, selectedCustomerId = "", disabled = false }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true);
      try {
        const data = await fetchCustomersForDropdown();
        const formatted = data.map(formatCustomerForDropdown);
        setCustomers(formatted);
      } catch (error) {
        console.error("Failed to load customers for dropdown:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCustomers();
  }, []);

  // Filter customers based on query
  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query) ||
      (customer.email && customer.email.toLowerCase().includes(query))
    );
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Update search query when selectedCustomerId changes
  useEffect(() => {
    if (selectedCustomer) {
      setSearchQuery(selectedCustomer.name);
    } else {
      setSearchQuery("");
    }
  }, [selectedCustomerId, selectedCustomer]);

  const handleSelect = (customer) => {
    setSearchQuery(customer.name);
    setShowDropdown(false);
    if (onSelect) {
      onSelect(customer);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filteredCustomers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredCustomers.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCustomers.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
        handleSelect(filteredCustomers[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        placeholder={loading ? "Loading customers..." : "🔍 Search customer by name or phone..."}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          fontSize: "13px",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
          backgroundColor: disabled ? "#f5f5f5" : "white",
        }}
      />

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            maxHeight: "300px",
            overflowY: "auto",
            marginTop: "6px",
            zIndex: 1000,
            padding: "8px 0",
          }}
        >
          {/* INDIVIDUAL CUSTOMERS SECTION */}
          <div
            style={{
              padding: "6px 12px",
              fontSize: "11px",
              fontWeight: "700",
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              borderBottom: "1px solid #f0f0f0",
              marginBottom: "4px",
            }}
          >
            Individual Customers
          </div>

          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer, index) => (
              <div
                key={customer.id}
                onClick={() => handleSelect(customer)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  cursor: "pointer",
                  backgroundColor:
                    highlightedIndex === index || selectedCustomerId === customer.id
                      ? "#F5F9FC"
                      : "transparent",
                  transition: "background-color 0.15s",
                }}
              >
                {/* customer avatar section */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    border: "2px solid #e0e0e0",
                  }}
                >
                  {customer.avatar ? (
                    <img
                      src={customer.avatar}
                      alt={customer.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        // Fallback to initial letter if image fails
                        e.target.style.display = "none";
                        e.target.parentNode.style.backgroundColor = "#3B9FD9";
                        e.target.parentNode.style.display = "flex";
                        e.target.parentNode.style.alignItems = "center";
                        e.target.parentNode.style.justifyContent = "center";
                        e.target.parentNode.innerHTML = `
                          <span style="color:white;font-size:13px;font-weight:600;">
                            ${customer.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        `;
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#3B9FD9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "13px",
                        fontWeight: "600",
                      }}
                    >
                      {customer.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                {/* customer info section */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#333" }}>
                    {customer.name}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#999",
                        margin: "0",
                      }}
                    >
                      📞 {customer.phone || "No phone"}
                    </p>
                    {customer.totalOrders > 0 && (
                      <span
                        style={{
                          fontSize: "10px",
                          backgroundColor: "#E8F5E9",
                          color: "#27AE60",
                          padding: "1px 6px",
                          borderRadius: "8px",
                          fontWeight: "500",
                        }}
                      >
                        {customer.totalOrders} orders
                      </span>
                    )}
                    {customer.status === "active" && (
                      <span
                        style={{
                          fontSize: "10px",
                          backgroundColor: "#F0F7FF",
                          color: "#3B9FD9",
                          padding: "1px 6px",
                          borderRadius: "8px",
                          fontWeight: "500",
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "12px", fontSize: "13px", color: "#999", textAlign: "center" }}>
              No customers found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearchDropdown;
