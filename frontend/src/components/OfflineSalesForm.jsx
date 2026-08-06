import React, { useState, useRef, useEffect } from "react";
import { recordOfflineSale } from "../services/offlineSalesService";
import { HiOutlineTrash, HiOutlinePlus } from "react-icons/hi2";

export const OfflineSalesForm = ({ sellerProducts = [], onSaleRecorded = null }) => {
  // ═══════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    paymentMethod: "CASH",
    notes: ""
  });

  const [cart, setCart] = useState([]);
  
  // States for adding a new item to the cart
  const [currentProductId, setCurrentProductId] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const cartRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════
  // HANDLE INPUT CHANGES
  // ═══════════════════════════════════════════════════════════════
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "customerPhone") {
      // Remove all non-numeric characters and limit to 10 digits
      const numbersOnly = value.replace(/\D/g, "").slice(0, 10);
      setFormData({
        ...formData,
        [name]: numbersOnly
      });
      setError(null);
      return;
    }

    setFormData({
      ...formData,
      [name]: value
    });
    setError(null);
  };

  const selectedProduct = sellerProducts.find(p => p._id === currentProductId);

  // ═══════════════════════════════════════════════════════════════
  // CART ACTIONS
  // ═══════════════════════════════════════════════════════════════
  const handleAddToCart = () => {
    if (!currentProductId) {
      setError("❌ Please select a product to add");
      return;
    }
    if (!currentQuantity || currentQuantity < 1) {
      setError("❌ Quantity must be at least 1");
      return;
    }
    
    // Check stock for this addition
    const existingCartItem = cart.find(item => item.productId === currentProductId);
    const requestedTotalQty = (existingCartItem ? existingCartItem.quantity : 0) + parseInt(currentQuantity);
    
    if (requestedTotalQty > selectedProduct.stock) {
      setError(`❌ Insufficient stock. Available: ${selectedProduct.stock}, Requested Total: ${requestedTotalQty}`);
      return;
    }

    if (existingCartItem) {
      // Update existing
      setCart(cart.map(item => 
        item.productId === currentProductId 
          ? { ...item, quantity: requestedTotalQty, subTotal: requestedTotalQty * item.price }
          : item
      ));
    } else {
      // Add new
      setCart([...cart, {
        productId: selectedProduct._id,
        name: selectedProduct.name,
        price: selectedProduct.price,
        quantity: parseInt(currentQuantity),
        subTotal: selectedProduct.price * parseInt(currentQuantity),
        maxStock: selectedProduct.stock
      }]);
    }

    // Reset current selection
    setCurrentProductId("");
    setCurrentQuantity(1);
    setSearchQuery("");
    setError(null);

    // Auto scroll to cart table
    setTimeout(() => {
      cartRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  };

  const handleRemoveFromCart = (id) => {
    setCart(cart.filter(item => item.productId !== id));
  };

  const cartTotal = cart.reduce((total, item) => total + item.subTotal, 0);

  // ═══════════════════════════════════════════════════════════════
  // SUBMIT FORM
  // ═══════════════════════════════════════════════════════════════
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerName.trim()) {
      setError("❌ Customer name is required");
      return;
    }
    if (!formData.customerPhone.trim()) {
      setError("❌ Customer phone is required");
      return;
    }
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.customerPhone)) {
      setError("❌ Invalid phone number (must be exactly 10 digits)");
      return;
    }
    if (cart.length === 0) {
      setError("❌ Cart is empty. Please add at least one product.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        customerPhone: `+91 ${formData.customerPhone}`,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      };

      console.log("🛒 Recording multi-product offline sale...", payload);
      const response = await recordOfflineSale(payload);

      if (response.success) {
        setSuccess(true);
        setSuccessMessage({
          itemsSold: response.itemsSold,
          totalAmount: response.totalAmount
        });

        // Reset
        setFormData({
          customerName: "",
          customerPhone: "",
          paymentMethod: "CASH",
          notes: ""
        });
        setCart([]);
        setCurrentProductId("");
        setCurrentQuantity(1);
        
        if (onSaleRecorded) onSaleRecorded(response);

        setTimeout(() => {
          setSuccess(false);
          setSuccessMessage(null);
        }, 5000);
      }
    } catch (err) {
      console.error("❌ Error recording sale:", err);
      setError(err.message || "Failed to record offline sale");
    } finally {
      setLoading(false);
    }
  };

  // Pre-calculate filtered products for autocomplete
  const filteredProducts = sellerProducts
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(searchQuery.toLowerCase());
      const bStarts = b.name.toLowerCase().startsWith(searchQuery.toLowerCase());
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });

  // Reset highlighted index when search query changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  const handleKeyDown = (e) => {
    if (!showDropdown || filteredProducts.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prevIndex) => {
        const nextIndex = prevIndex < filteredProducts.length - 1 ? prevIndex + 1 : 0;
        // Scroll active item into view
        setTimeout(() => {
          const container = dropdownRef.current?.querySelector(".custom-scrollbar");
          const activeEl = container?.querySelector(`[data-index="${nextIndex}"]`);
          if (activeEl && container) {
            const containerTop = container.scrollTop;
            const containerBottom = containerTop + container.clientHeight;
            const elemTop = activeEl.offsetTop;
            const elemBottom = elemTop + activeEl.clientHeight;

            if (elemBottom > containerBottom) {
              container.scrollTop = elemBottom - container.clientHeight;
            } else if (elemTop < containerTop) {
              container.scrollTop = elemTop;
            }
          }
        }, 10);
        return nextIndex;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prevIndex) => {
        const nextIndex = prevIndex > 0 ? prevIndex - 1 : filteredProducts.length - 1;
        // Scroll active item into view
        setTimeout(() => {
          const container = dropdownRef.current?.querySelector(".custom-scrollbar");
          const activeEl = container?.querySelector(`[data-index="${nextIndex}"]`);
          if (activeEl && container) {
            const containerTop = container.scrollTop;
            const containerBottom = containerTop + container.clientHeight;
            const elemTop = activeEl.offsetTop;
            const elemBottom = elemTop + activeEl.clientHeight;

            if (elemBottom > containerBottom) {
              container.scrollTop = elemBottom - container.clientHeight;
            } else if (elemTop < containerTop) {
              container.scrollTop = elemTop;
            }
          }
        }, 10);
        return nextIndex;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        const selected = filteredProducts[highlightedIndex];
        setCurrentProductId(selected._id);
        setSearchQuery(selected.name);
        setShowDropdown(false);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
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
      <h3 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 20px", color: "#333" }}>
        🛒 Record Offline Sale
      </h3>

      {/* MESSAGES */}
      {success && successMessage && (
        <div style={{ backgroundColor: "#E8F5E9", border: "1px solid #27AE60", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
          <p style={{ fontSize: "14px", fontWeight: "600", color: "#27AE60", margin: "0 0 8px" }}>✅ Sale Recorded Successfully!</p>
          <div style={{ fontSize: "13px", color: "#333", lineHeight: "1.6" }}>
            <p style={{ margin: "4px 0" }}><strong>Items Sold:</strong> {successMessage.itemsSold}</p>
            <p style={{ margin: "4px 0" }}><strong>Total Amount:</strong> ₹{successMessage.totalAmount.toLocaleString("en-IN")}</p>
          </div>
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: "#FFEBEE", border: "1px solid #E74C3C", borderRadius: "8px", padding: "12px", marginBottom: "16px", fontSize: "13px", color: "#C62828" }}>
          {error}
        </div>
      )}

      {/* CUSTOMER DETAILS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "#333" }}>
            👤 Customer Name *
          </label>
          <input
            type="text" name="customerName" value={formData.customerName} onChange={handleInputChange}
            placeholder="John Doe"
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box" }}
            disabled={loading}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "#333" }}>
            📞 Customer Phone *
          </label>
          <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: "6px", overflow: "hidden" }}>
            <span style={{ padding: "10px", backgroundColor: "#f0f0f0", color: "#666", fontSize: "13px", borderRight: "1px solid #ddd", display: "flex", alignItems: "center", fontWeight: "500" }}>
              +91
            </span>
            <input
              type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleInputChange}
              placeholder="9876543210"
              maxLength={10}
              style={{ flex: 1, padding: "10px", border: "none", fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box" }}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px dashed #eee", margin: "24px 0" }} />

      {/* ADD TO CART SECTION */}
      <div style={{ backgroundColor: "#f9fafb", padding: "16px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #eee" }}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#555" }}>➕ Add Products to Cart</h4>
        
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
          <div ref={dropdownRef} style={{ flex: "1 1 250px", position: "relative" }}>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#666" }}>Search & Select Product</label>
            
            {/* Direct Select Dropdown */}
            <select
              value={currentProductId}
              onChange={(e) => {
                const selectedId = e.target.value;
                setCurrentProductId(selectedId);
                const selected = sellerProducts.find(p => p._id === selectedId);
                if (selected) {
                  setSearchQuery(selected.name);
                } else {
                  setSearchQuery("");
                }
                setShowDropdown(false);
                setError(null);
              }}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "13px",
                boxSizing: "border-box",
                backgroundColor: "white",
                cursor: "pointer",
                marginBottom: "6px"
              }}
              disabled={loading || sellerProducts.length === 0}
            >
              <option value="">-- Choose Product --</option>
              {sellerProducts.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name} (Stock: {product.stock}) - ₹{product.price || product.salePrice}
                </option>
              ))}
            </select>

            {/* Instant Search Input */}
            <input
              type="text"
              placeholder="🔍 Or type to search product..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                setShowDropdown(true);
                const exactMatch = sellerProducts.find(p => p.name.toLowerCase() === val.toLowerCase());
                if (exactMatch) {
                  setCurrentProductId(exactMatch._id);
                }
              }}
              onFocus={() => {
                setShowDropdown(true);
                setTimeout(() => {
                  dropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
              onKeyDown={handleKeyDown}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "12px", boxSizing: "border-box" }}
              disabled={loading || sellerProducts.length === 0}
            />
            
            {/* DROPDOWN AUTOCOMPLETE MENU */}
            {showDropdown && (
              <ul className="custom-scrollbar" style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                maxHeight: "220px",
                overflowY: "auto",
                margin: "4px 0 0 0",
                padding: 0,
                listStyle: "none",
                zIndex: 9999
              }}>
                {filteredProducts.map((product, index) => (
                  <li
                    key={product._id}
                    data-index={index}
                    onClick={() => {
                      setCurrentProductId(product._id);
                      setSearchQuery(product.name);
                      setShowDropdown(false);
                      setError(null);
                    }}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontSize: "13px",
                      borderBottom: "1px solid #eee",
                      backgroundColor: currentProductId === product._id || highlightedIndex === index ? "#F3F4F6" : "white",
                      color: "#333",
                      fontWeight: highlightedIndex === index ? "600" : "normal"
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseLeave={() => setHighlightedIndex(-1)}
                  >
                    {product.name} (Stock: {product.stock}) - ₹{product.price}
                  </li>
                ))}
                {filteredProducts.length === 0 && (
                  <li style={{ padding: "10px 12px", fontSize: "13px", color: "#999", textAlign: "center" }}>
                    No products found
                  </li>
                )}
              </ul>
            )}
          </div>
          
          <div style={{ width: "90px", flexGrow: 0 }}>
            <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", color: "#666" }}>Quantity</label>
            <input
              type="number"
              min="1"
              max={selectedProduct?.stock || 9999}
              value={currentQuantity}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value, 10) || 1);
                setCurrentQuantity(val);
              }}
              onBlur={(e) => {
                if (!e.target.value || parseInt(e.target.value, 10) < 1) {
                  setCurrentQuantity(1);
                }
              }}
              style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box", height: "38px" }}
              disabled={loading || !currentProductId}
            />
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!currentProductId || loading}
            style={{
              padding: "9px 16px",
              backgroundColor: currentProductId ? "#3B9FD9" : "#e0e0e0",
              color: currentProductId ? "white" : "#999",
              border: "none",
              borderRadius: "6px",
              cursor: currentProductId ? "pointer" : "not-allowed",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              height: "38px",
              flexGrow: 0,
              minWidth: "100px"
            }}
          >
            <HiOutlinePlus /> Add
          </button>
        </div>
      </div>

      {/* CART ITEMS TABLE */}
      {cart.length > 0 && (
        <div ref={cartRef} style={{ marginBottom: "24px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#333" }}>🛍️ Current Cart ({cart.length} items)</h4>
          <div className="custom-scrollbar" style={{ border: "1px solid #eee", borderRadius: "8px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead style={{ backgroundColor: "#f8f9fa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: "10px 12px", color: "#666" }}>Product</th>
                  <th style={{ padding: "10px 12px", color: "#666" }}>Price</th>
                  <th style={{ padding: "10px 12px", color: "#666" }}>Qty</th>
                  <th style={{ padding: "10px 12px", color: "#666" }}>Subtotal</th>
                  <th style={{ padding: "10px 12px", color: "#666", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "500", color: "#333" }}>{item.name}</td>
                    <td style={{ padding: "10px 12px", color: "#555" }}>₹{item.price.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", color: "#555" }}>{item.quantity}</td>
                    <td style={{ padding: "10px 12px", color: "#27AE60", fontWeight: "600" }}>₹{item.subTotal.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <button 
                        type="button"
                        onClick={() => handleRemoveFromCart(item.productId)}
                        style={{ background: "none", border: "none", color: "#E74C3C", cursor: "pointer", padding: "4px" }}
                        title="Remove"
                      >
                        <HiOutlineTrash size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "12px", backgroundColor: "#F0F7FF", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #3B9FD9" }}>
              <span style={{ fontWeight: "600", color: "#333" }}>Grand Total:</span>
              <span style={{ fontWeight: "700", color: "#27AE60", fontSize: "16px" }}>₹{cartTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      )}

      <hr style={{ border: "none", borderTop: "1px dashed #eee", margin: "24px 0" }} />

      {/* PAYMENT & SUBMIT */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "#333" }}>💰 Payment Method</label>
          <select
            name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange}
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box", backgroundColor: "white" }}
            disabled={loading}
          >
            <option value="CASH">💵 Cash</option>
            <option value="CARD">💳 Card</option>
            <option value="UPI">📱 UPI</option>
            <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
            <option value="OTHER">📌 Other</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px", color: "#333" }}>📝 Notes</label>
          <input
            type="text" name="notes" value={formData.notes} onChange={handleInputChange}
            placeholder="E.g. Regular customer"
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box" }}
            disabled={loading}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || cart.length === 0}
        style={{
          width: "100%",
          padding: "12px",
          backgroundColor: (loading || cart.length === 0) ? "#ccc" : "#3B9FD9",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          cursor: (loading || cart.length === 0) ? "not-allowed" : "pointer",
          transition: "all 0.3s ease"
        }}
      >
        {loading ? "🔄 Recording Sale..." : `✅ Record Sale (₹${cartTotal.toLocaleString("en-IN")})`}
      </button>

    </div>
  );
};
