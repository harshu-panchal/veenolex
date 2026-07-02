import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../core/api/axios";

export const SellerAudienceSelector = ({ onSelectionChange }) => {

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════
  const [mode, setMode] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
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
  // FETCH SELLERS FROM API
  // ═══════════════════════════════════════
  const fetchSellers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("👥 Fetching sellers...");

      const response = await axiosInstance.get("/admin/sellers");

      // Correct path: response.data.result is array directly
      const items = response.data?.result || [];
      // Normalize _id to id
      const normalizedItems = items.map(item => ({
        ...item,
        id: item._id || item.id
      }));
      setSellers(normalizedItems);

      console.log("✅ Sellers loaded:", normalizedItems.length);

    } catch (err) {
      console.error("❌ Error fetching sellers:", err);
      setError("Failed to load sellers");
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════
  // HANDLE "SELECT ONE" BUTTON CLICK
  // ═══════════════════════════════════════
  const handleSelectOneClick = () => {
    if (mode === "one") {
      setMode(null);
      setSelectedSeller(null);
      setIsDropdownOpen(false);
      if (onSelectionChange) onSelectionChange(null);
      return;
    }

    setMode("one");
    setSelectedSeller(null);

    if (onSelectionChange) onSelectionChange({ type: "one", seller: null });

    if (sellers.length === 0) {
      fetchSellers();
    }
  };

  // ═══════════════════════════════════════
  // HANDLE "SELECT ALL" BUTTON CLICK
  // ═══════════════════════════════════════
  const handleSelectAllClick = () => {
    if (mode === "all") {
      setMode(null);
      if (onSelectionChange) onSelectionChange(null);
      return;
    }

    setMode("all");
    setSelectedSeller(null);
    setIsDropdownOpen(false);

    console.log("✅ Selected: All Sellers");

    if (onSelectionChange) {
      onSelectionChange({ type: "all", seller: null });
    }
  };

  // ═══════════════════════════════════════
  // HANDLE SELLER SELECTED FROM DROPDOWN
  // ═══════════════════════════════════════
  const handleSellerSelect = (seller) => {
    setSelectedSeller(seller);
    setIsDropdownOpen(false);
    setSearchQuery("");

    console.log("✅ Seller selected:", seller.shopName);

    if (onSelectionChange) {
      onSelectionChange({ type: "one", seller: seller });
    }
  };

  // ═══════════════════════════════════════
  // FILTERED SELLERS (search)
  // ═══════════════════════════════════════
  const filteredSellers = sellers.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.shopName?.toLowerCase().includes(q) ||
      s.name?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

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

      {/* TWO BUTTONS ROW */}
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
            border: `2px solid ${mode === "one" ? "#8B5CF6" : "#e0e0e0"}`,
            backgroundColor: mode === "one" ? "#F5F3FF" : "white",
            color: mode === "one" ? "#8B5CF6" : "#666",
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
          <span style={{ fontSize: "16px" }}>🏪</span>
          <span>Select One</span>
          {mode === "one" && (
            <span style={{
              fontSize: "10px",
              backgroundColor: "#8B5CF6",
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

      {/* SELECT ALL - CONFIRMATION BADGE */}
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
              All Sellers Selected
            </p>
            <p style={{
              fontSize: "11px",
              color: "#666",
              margin: "0"
            }}>
              Notification will be sent to all sellers
            </p>
          </div>
        </div>
      )}

      {/* SELECT ONE - DROPDOWN SECTION */}
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
              border: `2px solid ${selectedSeller ? "#8B5CF6" : "#e0e0e0"}`,
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
              {selectedSeller ? (
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "#8B5CF6",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                  flexShrink: 0
                }}>
                  {selectedSeller.shopName?.charAt(0)?.toUpperCase() || "S"}
                </div>
              ) : (
                <span style={{
                  fontSize: "18px",
                  flexShrink: 0
                }}>
                  🏪
                </span>
              )}

              {/* LABEL */}
              <div style={{ minWidth: 0 }}>
                {loading ? (
                  <span style={{
                    fontSize: "13px",
                    color: "#999"
                  }}>
                    ⏳ Loading sellers...
                  </span>
                ) : selectedSeller ? (
                  <>
                    <p style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#8B5CF6",
                      margin: "0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {selectedSeller.shopName}
                    </p>
                    <p style={{
                      fontSize: "11px",
                      color: "#999",
                      margin: "0"
                    }}>
                      {selectedSeller.name} • {selectedSeller.phone}
                    </p>
                  </>
                ) : (
                  <span style={{
                    fontSize: "13px",
                    color: "#999"
                  }}>
                    Click to select a store...
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

          {/* DROPDOWN LIST */}
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
                    placeholder="Search by store or owner name..."
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

              {/* SELLER LIST */}
              <div 
                className="custom-scrollbar"
                style={{
                  overflowY: "auto",
                  maxHeight: "170px",
                  flex: 1,
                  scrollBehavior: "smooth"
                }}
              >

                {filteredSellers.length === 0 && !loading ? (
                  <div style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#999",
                    fontSize: "13px"
                  }}>
                    {searchQuery
                      ? `No results for "${searchQuery}"`
                      : "No sellers found"}
                  </div>
                ) : (
                  filteredSellers.map((seller, index) => (
                    <div
                      key={seller.id}
                      onClick={() => handleSellerSelect(seller)}
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                        backgroundColor:
                          selectedSeller?.id === seller.id
                            ? "#F5F3FF"
                            : "white",
                        borderBottom:
                          index < filteredSellers.length - 1
                            ? "1px solid #f9f9f9"
                            : "none",
                        transition: "background-color 0.15s"
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSeller?.id !== seller.id) {
                          e.currentTarget.style.backgroundColor = "#f9f9f9";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSeller?.id !== seller.id) {
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
                          selectedSeller?.id === seller.id
                            ? "#8B5CF6"
                            : "#ddd"
                        }`,
                        backgroundColor:
                          selectedSeller?.id === seller.id
                            ? "#8B5CF6"
                            : "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.2s"
                      }}>
                        {selectedSeller?.id === seller.id && (
                          <span style={{
                            color: "white",
                            fontSize: "9px",
                            fontWeight: "bold"
                          }}>
                            ✓
                          </span>
                        )}
                      </div>

                      {/* AVATAR fallback to initials */}
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: "#8B5CF6",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: "600",
                        flexShrink: 0
                      }}>
                        {seller.shopName?.charAt(0)?.toUpperCase() || "S"}
                      </div>

                      {/* INFO */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: selectedSeller?.id === seller.id
                            ? "#8B5CF6"
                            : "#333",
                          margin: "0 0 3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>
                          {seller.shopName}
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
                            👤 {seller.name}
                          </span>
                          <span style={{
                            fontSize: "11px",
                            color: "#999"
                          }}>
                            📞 {seller.phone}
                          </span>
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* SELECTED SELLER BADGE */}
          {selectedSeller && !isDropdownOpen && (
            <div style={{
              marginTop: "10px",
              backgroundColor: "#F5F3FF",
              border: "1px solid #DDD6FE",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#8B5CF6",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold"
              }}>
                {selectedSeller.shopName?.charAt(0)?.toUpperCase() || "S"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#8B5CF6",
                  margin: "0 0 2px"
                }}>
                  ✅ {selectedSeller.shopName}
                </p>
                <p style={{
                  fontSize: "11px",
                  color: "#666",
                  margin: "0"
                }}>
                  Owner: {selectedSeller.name} • Contact: {selectedSeller.phone}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSeller(null);
                  if (onSelectionChange) {
                    onSelectionChange({ type: "one", seller: null });
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
