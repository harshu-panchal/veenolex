import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAdminProducts,
  createProductRequest,
  formatPrice
} from "../../../services/sellerProductRequestService";

export default function RequestProduct() {
  const navigate = useNavigate();

  // ─────────────────────────────────
  // STATE
  // ─────────────────────────────────
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  // cart = { productId: quantity }

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("browse");
  // steps: "browse" → "review" → "payment" → "success"

  const [paymentType, setPaymentType] = useState(null);
  const [sellerNote, setSellerNote] = useState("");
  const [submittedRequest, setSubmittedRequest] = useState(null);

  // ─────────────────────────────────
  // FETCH PRODUCTS
  // ─────────────────────────────────
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminProducts();
      setProducts(data);

      // Extract unique categories
      const cats = [
        ...new Set(data.map((p) => p.category).filter(Boolean))
      ];
      setCategories(cats);

      console.log("✅ Products loaded:", data.length);
    } catch (err) {
      setError("Failed to load products");
      console.error("❌ Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────
  // CART OPERATIONS
  // ─────────────────────────────────
  const updateCart = (productId, quantity) => {
    if (quantity <= 0) {
      const newCart = { ...cart };
      delete newCart[productId];
      setCart(newCart);
    } else {
      setCart({ ...cart, [productId]: quantity });
    }
  };

  const getCartQuantity = (productId) => cart[productId] || 0;

  const getCartItems = () =>
    products.filter((p) => cart[p._id] > 0).map((p) => ({
      ...p,
      selectedQuantity: cart[p._id],
      itemTotal: p.price * cart[p._id]
    }));

  const cartTotal = getCartItems().reduce(
    (sum, item) => sum + item.itemTotal, 0
  );

  const cartCount = Object.values(cart).reduce(
    (sum, qty) => sum + qty, 0
  );

  // ─────────────────────────────────
  // FILTERED PRODUCTS
  // ─────────────────────────────────
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory =
      selectedCategory === "ALL" || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  // ─────────────────────────────────
  // SUBMIT REQUEST
  // ─────────────────────────────────
  const handleSubmit = async () => {
    if (!paymentType) {
      setError("Please select a payment option");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const cartItems = getCartItems();
      const requestData = {
        items: cartItems.map((item) => ({
          productId: item._id,
          quantity: item.selectedQuantity
        })),
        paymentType: paymentType,
        sellerNote: sellerNote
      };

      const response = await createProductRequest(requestData);

      if (response.success) {
        if (response.data?.redirectUrl) {
          window.location.href = response.data.redirectUrl;
          return;
        }
        setSubmittedRequest(response.data);
        setStep("success");
        console.log("✅ Request submitted:", response.data.requestNumber);
      }

    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────
  // RENDER - BROWSE STEP
  // ─────────────────────────────────
  if (step === "browse" || step === "review" || step === "payment") {
    return (
      <div style={{
        padding: "24px",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh"
      }}>

        {/* PAGE HEADER */}
        <div style={{
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div>
            <h1 style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#333",
              margin: "0 0 6px"
            }}>
              📦 Request Products
            </h1>
            <p style={{
              fontSize: "14px",
              color: "#666",
              margin: "0"
            }}>
              Select products from admin catalog and submit your request
            </p>
          </div>

          {/* BUTTONS CONTAINER */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            {cartCount > 0 && (
              <button
                onClick={() => setStep("review")}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#3B9FD9",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                🛒 Review Order ({cartCount} items) — {formatPrice(cartTotal)}
              </button>
            )}
            
            <button
              onClick={() => navigate("/seller/requested-orders")}
              style={{
                padding: "8px 16px",
                backgroundColor: "#fff",
                color: "#3B9FD9",
                border: "1px solid #3B9FD9",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              Order Requested
            </button>
          </div>
        </div>

        {/* STEP INDICATOR */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "20px"
        }}>
          {["browse", "review", "payment"].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                padding: "6px 16px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "600",
                backgroundColor: step === s ? "#3B9FD9" : "#e0e0e0",
                color: step === s ? "white" : "#999"
              }}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {i < 2 && (
                <div style={{
                  width: "30px",
                  height: "2px",
                  backgroundColor: "#e0e0e0"
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* BROWSE STEP */}
        {step === "browse" && (
          <div>
            {/* SEARCH + FILTER */}
            <div style={{
              display: "flex",
              gap: "12px",
              marginBottom: "20px",
              flexWrap: "wrap"
            }}>
              <input
                type="text"
                placeholder="🔍 Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "10px 14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  outline: "none"
                }}
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  backgroundColor: "white"
                }}
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* PRODUCT GRID */}
            {loading ? (
              <div style={{
                textAlign: "center",
                padding: "60px",
                color: "#999"
              }}>
                ⏳ Loading products...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "60px",
                color: "#999"
              }}>
                No products found
              </div>
            ) : (
              <div style={{
                backgroundColor: "white",
                borderRadius: "12px",
                border: "1px solid #e0e0e0",
                overflow: "hidden"
              }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left"
                }}>
                  <thead style={{
                    backgroundColor: "#f9f9f9",
                    borderBottom: "2px solid #e0e0e0"
                  }}>
                    <tr>
                      <th style={{ padding: "16px", color: "#666", fontWeight: "600", fontSize: "14px" }}>Product</th>
                      <th style={{ padding: "16px", color: "#666", fontWeight: "600", fontSize: "14px", width: "15%" }}>Category</th>
                      <th style={{ padding: "16px", color: "#666", fontWeight: "600", fontSize: "14px", width: "15%" }}>Price</th>
                      <th style={{ padding: "16px", color: "#666", fontWeight: "600", fontSize: "14px", width: "20%", textAlign: "center" }}>Quantity</th>
                      <th style={{ padding: "16px", color: "#666", fontWeight: "600", fontSize: "14px", width: "15%", textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const qty = getCartQuantity(product._id);
                      return (
                        <tr
                          key={product._id}
                          style={{
                            borderBottom: "1px solid #e0e0e0",
                            backgroundColor: qty > 0 ? "#F0F8FF" : "white",
                            transition: "all 0.2s"
                          }}
                        >
                          <td style={{ padding: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                              <div style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "8px",
                                overflow: "hidden",
                                backgroundColor: "#f0f0f0",
                                flexShrink: 0
                              }}>
                                {product.images?.[0] ? (
                                  <img
                                    src={product.images[0]?.url || product.images[0]}
                                    alt={product.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <div style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "20px"
                                  }}>
                                    📦
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: "14px", fontWeight: "600", color: "#333" }}>
                                {product.name}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "16px" }}>
                            {product.category && (
                              <span style={{
                                fontSize: "12px",
                                backgroundColor: "#f0f0f0",
                                color: "#666",
                                padding: "4px 10px",
                                borderRadius: "12px"
                              }}>
                                {product.category}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "16px" }}>
                            <span style={{ fontSize: "15px", fontWeight: "700", color: "#27AE60" }}>
                              {formatPrice(product.price)}
                            </span>
                          </td>
                          <td style={{ padding: "16px", textAlign: "center" }}>
                            {qty === 0 ? (
                              <button
                                onClick={() => updateCart(product._id, 1)}
                                style={{
                                  padding: "8px 16px",
                                  backgroundColor: "#3B9FD9",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  fontWeight: "600"
                                }}
                              >
                                Add to Request
                              </button>
                            ) : (
                              <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "10px"
                              }}>
                                <button
                                  onClick={() => updateCart(product._id, qty - 1)}
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "6px",
                                    border: "1px solid #3B9FD9",
                                    backgroundColor: "white",
                                    color: "#3B9FD9",
                                    fontSize: "16px",
                                    fontWeight: "700",
                                    cursor: "pointer"
                                  }}
                                >
                                  −
                                </button>
                                <span style={{
                                  width: "24px",
                                  textAlign: "center",
                                  fontSize: "15px",
                                  fontWeight: "700",
                                  color: "#333"
                                }}>
                                  {qty}
                                </span>
                                <button
                                  onClick={() => updateCart(product._id, qty + 1)}
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: "#3B9FD9",
                                    color: "white",
                                    fontSize: "16px",
                                    fontWeight: "700",
                                    cursor: "pointer"
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "16px", textAlign: "right" }}>
                            <span style={{ fontSize: "15px", fontWeight: "700", color: "#333" }}>
                              {formatPrice(product.price * qty)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REVIEW STEP */}
        {step === "review" && (
          <div style={{ maxWidth: "700px", margin: "0 auto" }}>
            <h2 style={{
              fontSize: "20px",
              fontWeight: "700",
              margin: "0 0 20px",
              color: "#333"
            }}>
              🛒 Review Your Order
            </h2>

            {getCartItems().map((item) => (
              <div
                key={item._id}
                style={{
                  backgroundColor: "white",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  border: "1px solid #e0e0e0"
                }}
              >
                {/* IMAGE */}
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  flexShrink: 0,
                  backgroundColor: "#f0f0f0"
                }}>
                  {item.images?.[0] ? (
                    <img
                      src={item.images[0]?.url || item.images[0]}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px"
                    }}>
                      📦
                    </div>
                  )}
                </div>

                {/* INFO */}
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 4px"
                  }}>
                    {item.name}
                  </p>
                  <p style={{
                    fontSize: "12px",
                    color: "#999",
                    margin: "0"
                  }}>
                    {formatPrice(item.price)} × {item.selectedQuantity} units
                  </p>
                </div>

                {/* QUANTITY CONTROLS */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <button
                    onClick={() =>
                      updateCart(item._id, item.selectedQuantity - 1)
                    }
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                      backgroundColor: "white",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "700"
                    }}
                  >
                    −
                  </button>
                  <span style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    minWidth: "24px",
                    textAlign: "center"
                  }}>
                    {item.selectedQuantity}
                  </span>
                  <button
                    onClick={() =>
                      updateCart(item._id, item.selectedQuantity + 1)
                    }
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      border: "1px solid #3B9FD9",
                      backgroundColor: "#3B9FD9",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "700"
                    }}
                  >
                    +
                  </button>
                </div>

                {/* TOTAL */}
                <p style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#27AE60",
                  margin: "0",
                  minWidth: "80px",
                  textAlign: "right"
                }}>
                  {formatPrice(item.itemTotal)}
                </p>
              </div>
            ))}

            {/* ORDER TOTAL */}
            <div style={{
              backgroundColor: "white",
              borderRadius: "10px",
              padding: "16px",
              border: "2px solid #3B9FD9",
              marginTop: "16px"
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px"
              }}>
                <span style={{ color: "#666", fontSize: "14px" }}>
                  Subtotal ({cartCount} items)
                </span>
                <span style={{
                  fontWeight: "600",
                  fontSize: "14px"
                }}>
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "2px solid #f0f0f0",
                paddingTop: "10px",
                marginTop: "8px"
              }}>
                <span style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#333"
                }}>
                  Total Amount
                </span>
                <span style={{
                  fontSize: "20px",
                  fontWeight: "800",
                  color: "#27AE60"
                }}>
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>

            {/* SELLER NOTE */}
            <div style={{ marginTop: "16px" }}>
              <label style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#333",
                marginBottom: "6px"
              }}>
                📝 Note to Admin (Optional)
              </label>
              <textarea
                value={sellerNote}
                onChange={(e) => setSellerNote(e.target.value)}
                placeholder="Any special instructions..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            {/* BUTTONS */}
            <div style={{
              display: "flex",
              gap: "12px",
              marginTop: "20px"
            }}>
              <button
                onClick={() => setStep("browse")}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "white",
                  border: "2px solid #ddd",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#666"
                }}
              >
                ← Back to Browse
              </button>
              <button
                onClick={() => setStep("payment")}
                style={{
                  flex: 2,
                  padding: "12px",
                  backgroundColor: "#3B9FD9",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                Proceed to Payment →
              </button>
            </div>
          </div>
        )}

        {/* PAYMENT STEP */}
        {step === "payment" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <h2 style={{
              fontSize: "20px",
              fontWeight: "700",
              margin: "0 0 20px",
              color: "#333"
            }}>
              💰 Select Payment Option
            </h2>

            {/* PAYMENT OPTIONS */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "24px"
            }}>

              {/* PAY NOW */}
              <div
                onClick={() => setPaymentType("PAY_NOW")}
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  border: `3px solid ${
                    paymentType === "PAY_NOW" ? "#3B9FD9" : "#e0e0e0"
                  }`,
                  backgroundColor: paymentType === "PAY_NOW"
                    ? "#F0F7FF"
                    : "white",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s"
                }}
              >
                <div style={{
                  fontSize: "36px",
                  marginBottom: "12px"
                }}>
                  💳
                </div>
                <p style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: paymentType === "PAY_NOW"
                    ? "#3B9FD9"
                    : "#333",
                  margin: "0 0 8px"
                }}>
                  Pay Now
                </p>
                <p style={{
                  fontSize: "12px",
                  color: "#666",
                  margin: "0"
                }}>
                  Pay immediately and request is processed faster
                </p>
                {paymentType === "PAY_NOW" && (
                  <div style={{
                    marginTop: "12px",
                    backgroundColor: "#3B9FD9",
                    color: "white",
                    borderRadius: "12px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    fontWeight: "700",
                    display: "inline-block"
                  }}>
                    ✓ Selected
                  </div>
                )}
              </div>

              {/* PAY AFTER DELIVERY */}
              <div
                onClick={() => setPaymentType("PAY_AFTER_DELIVERY")}
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  border: `3px solid ${
                    paymentType === "PAY_AFTER_DELIVERY"
                      ? "#27AE60"
                      : "#e0e0e0"
                  }`,
                  backgroundColor: paymentType === "PAY_AFTER_DELIVERY"
                    ? "#E8F5E9"
                    : "white",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s"
                }}
              >
                <div style={{
                  fontSize: "36px",
                  marginBottom: "12px"
                }}>
                  📦
                </div>
                <p style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: paymentType === "PAY_AFTER_DELIVERY"
                    ? "#27AE60"
                    : "#333",
                  margin: "0 0 8px"
                }}>
                  Pay After Delivery
                </p>
                <p style={{
                  fontSize: "12px",
                  color: "#666",
                  margin: "0"
                }}>
                  Pay when you receive the products from admin
                </p>
                {paymentType === "PAY_AFTER_DELIVERY" && (
                  <div style={{
                    marginTop: "12px",
                    backgroundColor: "#27AE60",
                    color: "white",
                    borderRadius: "12px",
                    padding: "4px 12px",
                    fontSize: "12px",
                    fontWeight: "700",
                    display: "inline-block"
                  }}>
                    ✓ Selected
                  </div>
                )}
              </div>
            </div>

            {/* BILL SUMMARY */}
            <div style={{
              backgroundColor: "#f9f9f9",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px",
              border: "1px solid #e0e0e0"
            }}>
              <p style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#333",
                margin: "0 0 12px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                🧾 Order Summary
              </p>
              {getCartItems().map((item) => (
                <div
                  key={item._id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ color: "#666" }}>
                    {item.name} × {item.selectedQuantity}
                  </span>
                  <span style={{ fontWeight: "600" }}>
                    {formatPrice(item.itemTotal)}
                  </span>
                </div>
              ))}
              <div style={{
                borderTop: "2px solid #e0e0e0",
                paddingTop: "10px",
                marginTop: "10px",
                display: "flex",
                justifyContent: "space-between"
              }}>
                <span style={{
                  fontSize: "15px",
                  fontWeight: "700"
                }}>
                  Total
                </span>
                <span style={{
                  fontSize: "18px",
                  fontWeight: "800",
                  color: "#27AE60"
                }}>
                  {formatPrice(cartTotal)}
                </span>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div style={{
                backgroundColor: "#FFEBEE",
                border: "1px solid #FFCDD2",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "16px",
                fontSize: "13px",
                color: "#C62828"
              }}>
                {error}
              </div>
            )}

            {/* BUTTONS */}
            <div style={{
              display: "flex",
              gap: "12px"
            }}>
              <button
                onClick={() => setStep("review")}
                style={{
                  flex: 1,
                  padding: "14px",
                  backgroundColor: "white",
                  border: "2px solid #ddd",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#666"
                }}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!paymentType || submitting}
                style={{
                  flex: 2,
                  padding: "14px",
                  backgroundColor:
                    !paymentType || submitting ? "#ccc" : "#3B9FD9",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  cursor: !paymentType || submitting
                    ? "not-allowed"
                    : "pointer",
                  fontSize: "14px",
                  fontWeight: "700"
                }}
              >
                {submitting
                  ? "⏳ Submitting..."
                  : `🚀 Submit Request — ${formatPrice(cartTotal)}`}
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ─────────────────────────────────
  // SUCCESS STEP
  // ─────────────────────────────────
  if (step === "success" && submittedRequest) {
    return (
      <div style={{
        padding: "24px",
        maxWidth: "600px",
        margin: "0 auto"
      }}>

        {/* SUCCESS HEADER */}
        <div style={{
          textAlign: "center",
          padding: "32px",
          backgroundColor: "white",
          borderRadius: "16px",
          border: "2px solid #27AE60",
          marginBottom: "20px"
        }}>
          <div style={{
            fontSize: "60px",
            marginBottom: "16px"
          }}>
            ✅
          </div>
          <h2 style={{
            fontSize: "22px",
            fontWeight: "700",
            color: "#27AE60",
            margin: "0 0 8px"
          }}>
            Request Submitted Successfully!
          </h2>
          <p style={{
            fontSize: "14px",
            color: "#666",
            margin: "0"
          }}>
            Admin will review and process your request
          </p>
        </div>

        {/* BILL / INVOICE */}
        <div
          id="invoice-content"
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            overflow: "hidden"
          }}
        >

          {/* INVOICE HEADER */}
          <div style={{
            backgroundColor: "#3B9FD9",
            padding: "20px",
            color: "white"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <p style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  margin: "0 0 4px"
                }}>
                  🧾 INVOICE
                </p>
                <p style={{
                  fontSize: "13px",
                  opacity: 0.85,
                  margin: "0"
                }}>
                  {submittedRequest.requestNumber}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "600"
                }}>
                  {submittedRequest.paymentType === "PAY_NOW"
                    ? "💳 PAID"
                    : "📦 PAY AFTER DELIVERY"}
                </span>
              </div>
            </div>
          </div>

          {/* INVOICE BODY */}
          <div style={{ padding: "20px" }}>

            {/* ITEMS */}
            <p style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#999",
              textTransform: "uppercase",
              margin: "0 0 12px",
              letterSpacing: "0.5px"
            }}>
              Products Requested
            </p>

            {submittedRequest.items?.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid #f0f0f0"
                }}
              >
                <div>
                  <p style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#333",
                    margin: "0 0 2px"
                  }}>
                    {item.productName}
                  </p>
                  <p style={{
                    fontSize: "12px",
                    color: "#999",
                    margin: "0"
                  }}>
                    {formatPrice(item.pricePerUnit)} × {item.quantity} units
                  </p>
                </div>
                <p style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#333",
                  margin: "0"
                }}>
                  {formatPrice(item.totalPrice)}
                </p>
              </div>
            ))}

            {/* TOTAL */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 0 0",
              marginTop: "8px"
            }}>
              <span style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#333"
              }}>
                Total Amount
              </span>
              <span style={{
                fontSize: "22px",
                fontWeight: "800",
                color: "#27AE60"
              }}>
                {formatPrice(submittedRequest.totalAmount)}
              </span>
            </div>

            {/* STATUS */}
            <div style={{
              backgroundColor: "#FFF3E0",
              borderRadius: "8px",
              padding: "12px 14px",
              marginTop: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}>
              <span style={{ fontSize: "18px" }}>⏳</span>
              <div>
                <p style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#FF7A00",
                  margin: "0 0 2px"
                }}>
                  Status: Pending Admin Review
                </p>
                <p style={{
                  fontSize: "11px",
                  color: "#666",
                  margin: "0"
                }}>
                  You will be notified when admin approves your request
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginTop: "20px"
        }}>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "white",
              border: "2px solid #3B9FD9",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              color: "#3B9FD9"
            }}
          >
            🖨️ Print Bill
          </button>
          <button
            onClick={() => {
              setCart({});
              setPaymentType(null);
              setSubmittedRequest(null);
              setStep("browse");
            }}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "#3B9FD9",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            📦 New Request
          </button>
          <button
            onClick={() =>
              navigate("/seller/request-product/history")
            }
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: "#27AE60",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            📋 View History
          </button>
        </div>

      </div>
    );
  }

  return null;
}
