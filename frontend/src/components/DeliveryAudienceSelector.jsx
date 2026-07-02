import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../core/api/axios";

export const DeliveryAudienceSelector = ({ onSelectionChange }) => {

  // ═══════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════
  const [mode, setMode] = useState(null);
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
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
  // FETCH DELIVERY PARTNERS FROM API
  // ═══════════════════════════════════════
  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("👥 Fetching delivery partners...");

      const response = await axiosInstance.get("/admin/delivery-partners", {
        params: { limit: 200, page: 1 }
      });

      // Correct path: response.data.result.items
      const items = response.data?.result?.items || [];
      // Normalize _id to id
      const normalizedItems = items.map(item => ({
        ...item,
        id: item._id || item.id
      }));
      setPartners(normalizedItems);

      console.log("✅ Delivery partners loaded:", normalizedItems.length);

    } catch (err) {
      console.error("❌ Error fetching delivery partners:", err);
      setError("Failed to load delivery partners");
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
      setSelectedPartner(null);
      setIsDropdownOpen(false);
      if (onSelectionChange) onSelectionChange(null);
      return;
    }

    setMode("one");
    setSelectedPartner(null);

    if (onSelectionChange) onSelectionChange({ type: "one", partner: null });

    if (partners.length === 0) {
      fetchPartners();
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
    setSelectedPartner(null);
    setIsDropdownOpen(false);

    console.log("✅ Selected: All Delivery Partners");

    if (onSelectionChange) {
      onSelectionChange({ type: "all", partner: null });
    }
  };

  // ═══════════════════════════════════════
  // HANDLE PARTNER SELECTED FROM DROPDOWN
  // ═══════════════════════════════════════
  const handlePartnerSelect = (partner) => {
    setSelectedPartner(partner);
    setIsDropdownOpen(false);
    setSearchQuery("");

    console.log("✅ Partner selected:", partner.name);

    if (onSelectionChange) {
      onSelectionChange({ type: "one", partner: partner });
    }
  };

  // ═══════════════════════════════════════
  // FILTERED PARTNERS (search)
  // ═══════════════════════════════════════
  const filteredPartners = partners.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.vehicleType?.toLowerCase().includes(q)
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
            border: `2px solid ${mode === "one" ? "#10B981" : "#e0e0e0"}`,
            backgroundColor: mode === "one" ? "#ECFDF5" : "white",
            color: mode === "one" ? "#10B981" : "#666",
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
          <span style={{ fontSize: "16px" }}>🛵</span>
          <span>Select One</span>
          {mode === "one" && (
            <span style={{
              fontSize: "10px",
              backgroundColor: "#10B981",
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
              All Delivery Partners Selected
            </p>
            <p style={{
              fontSize: "11px",
              color: "#666",
              margin: "0"
            }}>
              Notification will be sent to all riders
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
              border: `2px solid ${selectedPartner ? "#10B981" : "#e0e0e0"}`,
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
              {selectedPartner ? (
                <img
                  src={selectedPartner.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(selectedPartner.name)}`}
                  alt={selectedPartner.name}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #10B981",
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
                    ⏳ Loading partners...
                  </span>
                ) : selectedPartner ? (
                  <>
                    <p style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#10B981",
                      margin: "0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {selectedPartner.name}
                    </p>
                    <p style={{
                      fontSize: "11px",
                      color: "#999",
                      margin: "0"
                    }}>
                      {selectedPartner.phone} • {selectedPartner.vehicleType}
                    </p>
                  </>
                ) : (
                  <span style={{
                    fontSize: "13px",
                    color: "#999"
                  }}>
                    Click to select a rider...
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
                    placeholder="Search by rider name or phone..."
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

              {/* PARTNER LIST */}
              <div 
                className="custom-scrollbar"
                style={{
                  overflowY: "auto",
                  maxHeight: "170px",
                  flex: 1,
                  scrollBehavior: "smooth"
                }}
              >

                {filteredPartners.length === 0 && !loading ? (
                  <div style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#999",
                    fontSize: "13px"
                  }}>
                    {searchQuery
                      ? `No results for "${searchQuery}"`
                      : "No partners found"}
                  </div>
                ) : (
                  filteredPartners.map((partner, index) => (
                    <div
                      key={partner.id}
                      onClick={() => handlePartnerSelect(partner)}
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                        backgroundColor:
                          selectedPartner?.id === partner.id
                            ? "#ECFDF5"
                            : "white",
                        borderBottom:
                          index < filteredPartners.length - 1
                            ? "1px solid #f9f9f9"
                            : "none",
                        transition: "background-color 0.15s"
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPartner?.id !== partner.id) {
                          e.currentTarget.style.backgroundColor = "#f9f9f9";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPartner?.id !== partner.id) {
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
                          selectedPartner?.id === partner.id
                            ? "#10B981"
                            : "#ddd"
                        }`,
                        backgroundColor:
                          selectedPartner?.id === partner.id
                            ? "#10B981"
                            : "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.2s"
                      }}>
                        {selectedPartner?.id === partner.id && (
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
                          src={partner.profileImage}
                          alt={partner.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                          }}
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentNode.style.backgroundColor = "#10B981";
                            e.target.parentNode.style.display = "flex";
                            e.target.parentNode.style.alignItems = "center";
                            e.target.parentNode.style.justifyContent = "center";
                            e.target.parentNode.innerHTML =
                              `<span style="color:white;font-size:13px;font-weight:600;">
                                ${partner.name?.charAt(0)?.toUpperCase() || "?"}
                              </span>`;
                          }}
                        />
                      </div>

                      {/* INFO */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: selectedPartner?.id === partner.id
                            ? "#10B981"
                            : "#333",
                          margin: "0 0 3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>
                          {partner.name}
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
                            📞 {partner.phone}
                          </span>
                          <span style={{
                            fontSize: "10px",
                            backgroundColor: "#ECFDF5",
                            color: "#059669",
                            padding: "1px 6px",
                            borderRadius: "8px",
                            fontWeight: "500",
                            textTransform: "capitalize"
                          }}>
                            🚲 {partner.vehicleType}
                          </span>
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* SELECTED PARTNER BADGE */}
          {selectedPartner && !isDropdownOpen && (
            <div style={{
              marginTop: "10px",
              backgroundColor: "#ECFDF5",
              border: "1px solid #A7F3D0",
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
                backgroundColor: "#10B981",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold"
              }}>
                {selectedPartner.name?.charAt(0)?.toUpperCase() || "R"}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#10B981",
                  margin: "0 0 2px"
                }}>
                  ✅ {selectedPartner.name}
                </p>
                <p style={{
                  fontSize: "11px",
                  color: "#666",
                  margin: "0"
                }}>
                  Contact: {selectedPartner.phone} • Vehicle: {selectedPartner.vehicleType}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPartner(null);
                  if (onSelectionChange) {
                    onSelectionChange({ type: "one", partner: null });
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
