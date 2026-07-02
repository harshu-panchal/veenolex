import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../core/api/axios";

export const CustomerAudienceSelector = ({ onSelectionChange }) => {

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════
  const [mode, setMode] = useState(null);
  // null = nothing selected
  // "one" = Select One mode
  // "all" = Select All mode

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dropdownRef = useRef(null);

  // ═══════════════════════════════════════
  // CLOSE DROPDOWN ON OUTSIDE CLICK
  // ═══════════════════════════════════════
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () =>
      document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ═══════════════════════════════════════
  // FETCH CUSTOMERS FROM API
  // ═══════════════════════════════════════
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("👥 Fetching customers...");

      const response = await axiosInstance.get("/admin/users", {
        params: { limit: 100, page: 1 }
      });

      // Correct path: response.data.result.items
      const items = response.data?.result?.items || [];
      setCustomers(items);

      console.log("✅ Customers loaded:", items.length);

    } catch (err) {
      console.error("❌ Error fetching customers:", err);
      setError("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════
  // HANDLE "SELECT ONE" BUTTON CLICK
  // ═══════════════════════════════════════
  const handleSelectOneClick = () => {
    // Toggle off if already in "one" mode
    if (mode === "one") {
      setMode(null);
      setSelectedCustomer(null);
      setIsDropdownOpen(false);
      if (onSelectionChange) onSelectionChange(null);
      return;
    }

    // Switch to "one" mode
    setMode("one");
    setSelectedCustomer(null);

    // Notify parent: deselect "all"
    if (onSelectionChange) onSelectionChange({ type: "one", customer: null });

    // Fetch customers if not loaded
    if (customers.length === 0) {
      fetchCustomers();
    }
  };

  // ═══════════════════════════════════════
  // HANDLE "SELECT ALL" BUTTON CLICK
  // ═══════════════════════════════════════
  const handleSelectAllClick = () => {
    // Toggle off if already in "all" mode
    if (mode === "all") {
      setMode(null);
      if (onSelectionChange) onSelectionChange(null);
      return;
    }

    // Switch to "all" mode
    setMode("all");
    setSelectedCustomer(null);
    setIsDropdownOpen(false);

    console.log("✅ Selected: All Customers");

    // Notify parent
    if (onSelectionChange) {
      onSelectionChange({ type: "all", customer: null });
    }
  };

  // ═══════════════════════════════════════
  // HANDLE CUSTOMER SELECTED FROM DROPDOWN
  // ═══════════════════════════════════════
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setIsDropdownOpen(false);
    setSearchQuery("");

    console.log("✅ Customer selected:", customer.name);

    // Notify parent
    if (onSelectionChange) {
      onSelectionChange({ type: "one", customer: customer });
    }
  };

  // ═══════════════════════════════════════
  // FILTERED CUSTOMERS (search)
  // ═══════════════════════════════════════
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div style={{
      marginTop: "12px",
      padding: "0"
    }}>
      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* ─────────────────────────────────── */}
      {/* TWO BUTTONS ROW */}
      {/* ─────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px",
        marginTop: "12px"
      }}>

        {/* BUTTON 1: SELECT ONE */}
        <button
          onClick={handleSelectOneClick}
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: `2px solid ${mode === "one" ? "#3B9FD9" : "#e0e0e0"}`,
            backgroundColor: mode === "one" ? "#F0F7FF" : "white",
            color: mode === "one" ? "#3B9FD9" : "#666",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.25s ease"
          }}
        >
          <span style={{ fontSize: "16px" }}>👤</span>
          <span>Select One</span>
          {mode === "one" && (
            <span style={{
              fontSize: "10px",
              backgroundColor: "#3B9FD9",
              color: "white",
              borderRadius: "10px",
              padding: "2px 6px"
            }}>
              ON
            </span>
          )}
        </button>

        {/* BUTTON 2: SELECT ALL */}
        <button
          onClick={handleSelectAllClick}
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: `2px solid ${mode === "all" ? "#27AE60" : "#e0e0e0"}`,
            backgroundColor: mode === "all" ? "#E8F5E9" : "white",
            color: mode === "all" ? "#27AE60" : "#666",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.25s ease"
          }}
        >
          <span style={{ fontSize: "16px" }}>👥</span>
          <span>Select All</span>
          {mode === "all" && (
            <span style={{
              fontSize: "10px",
              backgroundColor: "#27AE60",
              color: "white",
              borderRadius: "10px",
              padding: "2px 6px"
            }}>
              ON
            </span>
          )}
        </button>

      </div>

      {/* ─────────────────────────────────── */}
      {/* SELECT ALL - CONFIRMATION BADGE */}
      {/* ─────────────────────────────────── */}
      {mode === "all" && (
        <div style={{
          marginTop: "12px",
          backgroundColor: "#E8F5E9",
          border: "1px solid #A5D6A7",
          borderRadius: "8px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <span style={{ fontSize: "20px" }}>✅</span>
          <div>
            <p style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#27AE60",
              margin: "0 0 2px"
            }}>
              All Customers Selected
            </p>
            <p style={{
              fontSize: "11px",
              color: "#666",
              margin: "0"
            }}>
              Notification will be sent to all customers
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────── */}
      {/* SELECT ONE - DROPDOWN SECTION */}
      {/* ─────────────────────────────────── */}
      {mode === "one" && (
        <div
          ref={dropdownRef}
          style={{
            marginTop: "12px",
            position: "relative"
          }}
        >

          {/* DROPDOWN TRIGGER */}
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "8px",
              border: `2px solid ${selectedCustomer ? "#3B9FD9" : "#e0e0e0"}`,
              backgroundColor: "white",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              transition: "all 0.2s ease"
            }}
          >

            {/* LEFT SIDE */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: 1,
              minWidth: 0
            }}>

              {/* AVATAR */}
              {selectedCustomer ? (
                <img
                  src={selectedCustomer.avatar}
                  alt={selectedCustomer.name}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #3B9FD9",
                    flexShrink: 0
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <span style={{
                  fontSize: "18px",
                  flexShrink: 0
                }}>
                  👤
                </span>
              )}

              {/* LABEL */}
              <div style={{ minWidth: 0 }}>
                {loading ? (
                  <span style={{
                    fontSize: "13px",
                    color: "#999"
                  }}>
                    ⏳ Loading customers...
                  </span>
                ) : selectedCustomer ? (
                  <>
                    <p style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#3B9FD9",
                      margin: "0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {selectedCustomer.name}
                    </p>
                    <p style={{
                      fontSize: "11px",
                      color: "#999",
                      margin: "0"
                    }}>
                      {selectedCustomer.phone}
                    </p>
                  </>
                ) : (
                  <span style={{
                    fontSize: "13px",
                    color: "#999"
                  }}>
                    Click to select a customer...
                  </span>
                )}
              </div>
            </div>

            {/* ARROW */}
            <span style={{
              fontSize: "11px",
              color: "#999",
              transform: isDropdownOpen
                ? "rotate(180deg)"
                : "rotate(0deg)",
              transition: "transform 0.3s ease",
              flexShrink: 0
            }}>
              ▼
            </span>

          </button>

          {/* ─────────────────────────── */}
          {/* DROPDOWN LIST */}
          {/* ─────────────────────────── */}
          {isDropdownOpen && (
            <div style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: 0,
              right: 0,
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "10px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              zIndex: 999,
              overflow: "hidden",
              maxHeight: "220px",
              display: "flex",
              flexDirection: "column",
              animation: "slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}>

              {/* SEARCH BOX */}
              <div style={{
                padding: "10px 12px",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: "white",
                position: "sticky",
                top: 0,
                zIndex: 1
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "6px",
                  padding: "8px 10px"
                }}>
                  <span style={{ fontSize: "13px" }}>🔍</span>
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or phone..."
                    style={{
                      border: "none",
                      outline: "none",
                      fontSize: "13px",
                      backgroundColor: "transparent",
                      width: "100%",
                      fontFamily: "inherit",
                      color: "#333"
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "#999",
                        padding: "0",
                        lineHeight: 1
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div style={{
                  padding: "12px",
                  textAlign: "center",
                  color: "#E74C3C",
                  fontSize: "12px"
                }}>
                  {error}
                </div>
              )}

              {/* CUSTOMER LIST */}
              <div 
                className="custom-scrollbar"
                style={{
                  overflowY: "auto",
                  maxHeight: "170px",
                  flex: 1,
                  scrollBehavior: "smooth"
                }}
              >

                {filteredCustomers.length === 0 && !loading ? (
                  <div style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#999",
                    fontSize: "13px"
                  }}>
                    {searchQuery
                      ? `No results for "${searchQuery}"`
                      : "No customers found"}
                  </div>
                ) : (
                  filteredCustomers.map((customer, index) => (
                    <div
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                        backgroundColor:
                          selectedCustomer?.id === customer.id
                            ? "#F0F7FF"
                            : "white",
                        borderBottom:
                          index < filteredCustomers.length - 1
                            ? "1px solid #f9f9f9"
                            : "none",
                        transition: "background-color 0.15s"
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCustomer?.id !== customer.id) {
                          e.currentTarget.style.backgroundColor = "#f9f9f9";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCustomer?.id !== customer.id) {
                          e.currentTarget.style.backgroundColor = "white";
                        }
                      }}
                    >

                      {/* SELECTED INDICATOR */}
                      <div style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: `2px solid ${
                          selectedCustomer?.id === customer.id
                            ? "#3B9FD9"
                            : "#ddd"
                        }`,
                        backgroundColor:
                          selectedCustomer?.id === customer.id
                            ? "#3B9FD9"
                            : "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.2s"
                      }}>
                        {selectedCustomer?.id === customer.id && (
                          <span style={{
                            color: "white",
                            fontSize: "9px",
                            fontWeight: "bold"
                          }}>
                            ✓
                          </span>
                        )}
                      </div>

                      {/* AVATAR */}
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "2px solid #e0e0e0",
                        flexShrink: 0
                      }}>
                        <img
                          src={customer.avatar}
                          alt={customer.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                          }}
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentNode.style.backgroundColor = "#3B9FD9";
                            e.target.parentNode.style.display = "flex";
                            e.target.parentNode.style.alignItems = "center";
                            e.target.parentNode.style.justifyContent = "center";
                            e.target.parentNode.innerHTML =
                              `<span style="color:white;font-size:13px;font-weight:600;">
                                ${customer.name?.charAt(0)?.toUpperCase() || "?"}
                              </span>`;
                          }}
                        />
                      </div>

                      {/* INFO */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: selectedCustomer?.id === customer.id
                            ? "#3B9FD9"
                            : "#333",
                          margin: "0 0 3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>
                          {customer.name}
                        </p>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap"
                        }}>
                          <span style={{
                            fontSize: "11px",
                            color: "#999"
                          }}>
                            📞 {customer.phone}
                          </span>
                          {customer.totalOrders > 0 && (
                            <span style={{
                              fontSize: "10px",
                              backgroundColor: "#E8F5E9",
                              color: "#27AE60",
                              padding: "1px 6px",
                              borderRadius: "8px",
                              fontWeight: "500"
                            }}>
                              {customer.totalOrders} orders
                            </span>
                          )}
                        </div>
                      </div>

                      {/* TOTAL SPENT */}
                      <div style={{
                        textAlign: "right",
                        flexShrink: 0
                      }}>
                        <p style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#27AE60",
                          margin: "0"
                        }}>
                          ₹{(customer.totalSpent || 0).toLocaleString("en-IN")}
                        </p>
                        <p style={{
                          fontSize: "10px",
                          color: "#999",
                          margin: "0"
                        }}>
                          spent
                        </p>
                      </div>

                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* SELECTED CUSTOMER BADGE */}
          {selectedCustomer && !isDropdownOpen && (
            <div style={{
              marginTop: "10px",
              backgroundColor: "#F0F7FF",
              border: "1px solid #BBDEFB",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>
              <img
                src={selectedCustomer.avatar}
                alt={selectedCustomer.name}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "2px solid #3B9FD9",
                  objectFit: "cover"
                }}
              />
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#3B9FD9",
                  margin: "0 0 2px"
                }}>
                  ✅ {selectedCustomer.name}
                </p>
                <p style={{
                  fontSize: "11px",
                  color: "#666",
                  margin: "0"
                }}>
                  {selectedCustomer.phone} •{" "}
                  {selectedCustomer.totalOrders} orders •{" "}
                  ₹{(selectedCustomer.totalSpent || 0).toLocaleString("en-IN")} spent
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  if (onSelectionChange) {
                    onSelectionChange({ type: "one", customer: null });
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#999",
                  fontSize: "16px",
                  padding: "0",
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
