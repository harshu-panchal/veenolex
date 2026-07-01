import React, { useState, useEffect } from "react";
import { fetchOfflineSalesHistory, formatSaleDate, formatCurrency, deleteOfflineSale } from "../services/offlineSalesService";

export const OfflineSalesHistory = ({ sellerProducts = [], onSaleDeleted = null }) => {
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    productId: "",
    startDate: "",
    endDate: ""
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ═══════════════════════════════════════════════════════════════
  // FETCH DATA
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    fetchHistory();
  }, [filters]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchOfflineSalesHistory(filters);

      setSales(response.data || []);
      setSummary(response.summary || {});

      console.log("✅ History fetched:", response.count, "sales");
    } catch (err) {
      console.error("❌ Error fetching history:", err);
      setError(err.message || "Failed to fetch history");
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLE DELETE
  // ═══════════════════════════════════════════════════════════════
  const handleDelete = async (saleId) => {
    try {
      const result = await deleteOfflineSale(saleId);

      if (result.success) {
        // Remove from list
        setSales(sales.filter(s => s._id !== saleId));

        // Show success
        alert(`✅ Sale deleted!\nStock restored: +${result.restoredQuantity} units`);

        // Call parent callback
        if (onSaleDeleted) {
          onSaleDeleted(saleId);
        }

        // Refresh data
        fetchHistory();
      }
    } catch (err) {
      alert(`❌ Error deleting sale: ${err.message}`);
    } finally {
      setDeleteConfirm(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{
      backgroundColor: "white",
      padding: "20px",
      borderRadius: "12px",
      border: "1px solid #e0e0e0"
    }}>

      <h3 style={{
        fontSize: "18px",
        fontWeight: "600",
        margin: "0 0 20px",
        color: "#333"
      }}>
        📋 Offline Sales History
      </h3>

      {/* FILTERS */}
      <div style={{
        backgroundColor: "#f9f9f9",
        padding: "16px",
        borderRadius: "8px",
        marginBottom: "20px"
      }}>

        <p style={{
          fontSize: "12px",
          fontWeight: "600",
          color: "#666",
          margin: "0 0 12px"
        }}>
          🔍 Filter Sales:
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "12px"
        }}>

          {/* PRODUCT FILTER */}
          <div>
            <select
              value={filters.productId}
              onChange={(e) => setFilters({...filters, productId: e.target.value})}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "12px",
                boxSizing: "border-box",
                fontFamily: "inherit",
                cursor: "pointer",
                backgroundColor: "white"
              }}
            >
              <option value="">All Products</option>
              {sellerProducts.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* START DATE FILTER */}
          <div>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "12px",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* END DATE FILTER */}
          <div>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "12px",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* CLEAR FILTERS */}
          <div>
            <button
              onClick={() => {
                setFilters({
                  productId: "",
                  startDate: "",
                  endDate: ""
                });
              }}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#e0e0e0"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "#f0f0f0"}
            >
              🔄 Clear
            </button>
          </div>

        </div>

      </div>

      {/* SUMMARY */}
      {summary && sales.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px",
          marginBottom: "20px"
        }}>

          <div style={{
            backgroundColor: "#F0F7FF",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #3B9FD9"
          }}>
            <p style={{
              fontSize: "11px",
              color: "#666",
              margin: "0 0 4px",
              fontWeight: "500"
            }}>
              📊 Total Sales:
            </p>
            <p style={{
              fontSize: "18px",
              fontWeight: "bold",
              margin: "0",
              color: "#3B9FD9"
            }}>
              {summary.totalSales}
            </p>
          </div>

          <div style={{
            backgroundColor: "#E8F5E9",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #27AE60"
          }}>
            <p style={{
              fontSize: "11px",
              color: "#666",
              margin: "0 0 4px",
              fontWeight: "500"
            }}>
              💰 Total Revenue:
            </p>
            <p style={{
              fontSize: "18px",
              fontWeight: "bold",
              margin: "0",
              color: "#27AE60"
            }}>
              {formatCurrency(summary.totalRevenue)}
            </p>
          </div>

          <div style={{
            backgroundColor: "#FFF3E0",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #FF7A00"
          }}>
            <p style={{
              fontSize: "11px",
              color: "#666",
              margin: "0 0 4px",
              fontWeight: "500"
            }}>
              📦 Total Quantity:
            </p>
            <p style={{
              fontSize: "18px",
              fontWeight: "bold",
              margin: "0",
              color: "#FF7A00"
            }}>
              {summary.totalQuantity} units
            </p>
          </div>

        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{
          textAlign: "center",
          padding: "40px",
          color: "#999"
        }}>
          ⏳ Loading sales history...
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div style={{
          backgroundColor: "#FFEBEE",
          border: "1px solid #E74C3C",
          borderRadius: "8px",
          padding: "12px",
          fontSize: "13px",
          color: "#C62828",
          marginBottom: "16px"
        }}>
          ❌ {error}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && sales.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "40px",
          color: "#999"
        }}>
          <p style={{ fontSize: "14px", margin: "0 0 8px" }}>
            📭 No offline sales recorded yet
          </p>
          <p style={{ fontSize: "12px", margin: "0" }}>
            Start recording sales to see them here
          </p>
        </div>
      )}

      {/* TABLE */}
      {!loading && sales.length > 0 && (
        <div style={{
          overflowX: "auto"
        }}>

          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px"
          }}>

            <thead>
              <tr style={{
                backgroundColor: "#f0f0f0",
                borderBottom: "2px solid #ddd"
              }}>
                <th style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#333"
                }}>
                  📅 Date
                </th>
                <th style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#333"
                }}>
                  👤 Customer
                </th>
                <th style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#333"
                }}>
                  📞 Phone
                </th>
                <th style={{
                  padding: "12px",
                  textAlign: "left",
                  fontWeight: "600",
                  color: "#333"
                }}>
                  📦 Items
                </th>
                <th style={{
                  padding: "12px",
                  textAlign: "center",
                  fontWeight: "600",
                  color: "#333"
                }}>
                  Qty
                </th>
                <th style={{
                  padding: "12px",
                  textAlign: "right",
                  fontWeight: "600",
                  color: "#333"
                }}>
                  💰 Amount
                </th>
                <th style={{
                  padding: "12px",
                  textAlign: "center",
                  fontWeight: "600",
                  color: "#333"
                }}>
                  ⚙️ Action
                </th>
              </tr>
            </thead>

            <tbody>
              {sales.map((sale, index) => (
                <tr
                  key={sale._id}
                  style={{
                    borderBottom: "1px solid #eee",
                    backgroundColor: index % 2 === 0 ? "#fafafa" : "white"
                  }}
                >
                  <td style={{ padding: "12px" }}>
                    {formatSaleDate(sale.createdAt)}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <strong>{sale.customerName}</strong>
                  </td>
                  <td style={{ padding: "12px" }}>
                    {sale.customerPhone}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {sale.items && sale.items.length > 0 ? (
                      <span title={sale.items.map(i => i.productName).join(", ")}>
                        {sale.items.length} item(s)
                      </span>
                    ) : "Legacy Record"}
                  </td>
                  <td style={{
                    padding: "12px",
                    textAlign: "center",
                    fontWeight: "600"
                  }}>
                    {sale.items ? sale.items.reduce((sum, item) => sum + item.quantity, 0) : sale.quantity || 0}
                  </td>
                  <td style={{
                    padding: "12px",
                    textAlign: "right",
                    fontWeight: "600",
                    color: "#27AE60"
                  }}>
                    {formatCurrency(sale.totalAmount)}
                  </td>
                  <td style={{
                    padding: "12px",
                    textAlign: "center"
                  }}>
                    <button
                      onClick={() => setDeleteConfirm(sale._id)}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#FFE8E8",
                        color: "#E74C3C",
                        border: "1px solid #E74C3C",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: "500",
                        transition: "all 0.3s ease"
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = "#FFE8E8";
                        e.target.style.color = "#E74C3C";
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = "#E74C3C";
                        e.target.style.color = "white";
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>

        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>

          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "20px",
            maxWidth: "400px",
            textAlign: "center"
          }}>

            <p style={{
              fontSize: "16px",
              fontWeight: "600",
              margin: "0 0 12px",
              color: "#333"
            }}>
              ⚠️ Delete Sale?
            </p>

            <p style={{
              fontSize: "13px",
              color: "#666",
              margin: "0 0 20px",
              lineHeight: "1.5"
            }}>
              This will delete the offline sale and restore the stock.
              This action cannot be undone.
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px"
            }}>

              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: "10px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500"
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: "10px",
                  backgroundColor: "#E74C3C",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500"
                }}
              >
                Yes, Delete
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};
