import { useState, useEffect, useRef } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Plus,
  Trash2,
  Minus,
  Barcode,
  Camera,
  Maximize2,
  Settings,
  CreditCard,
  Layers,
  Save,
  CheckCircle,
  X,
  RefreshCw,
  Printer,
  ChevronRight,
  Box
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import axiosInstance from "@core/api/axios";
import adminPosApi from "../../services/api/posApi";
import { getCartLineId } from "../../../../utils/posCartLineId";
import { expandPOSProducts } from "../../../../utils/posProductExpansion";
import { calculateInclusiveGST, splitGST } from "../../../../utils/gstUtils";
import { getAdminPOSBillSettings } from "../../../../utils/adminPosBillSettings";
import { initWedgeScanner } from "../../../../utils/scannerPlatform";
import QRScannerModal from "../../../../components/QRScannerModal";

export default function AdminPOSOrders() {
  // ── States ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState([]);

  // Multi-bill state
  const [bills, setBills] = useState([
    { id: 1, name: "Tab 1", cart: [], customer: { _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" } },
    { id: 2, name: "Tab 2", cart: [], customer: { _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" } },
    { id: 3, name: "Tab 3", cart: [], customer: { _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" } },
  ]);
  const [activeTab, setActiveTab] = useState(1);

  // Customer selection
  const [customers, setCustomers] = useState([]);
  const [searchCustomerQuery, setSearchCustomerQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });

  // Camera Barcode Scanner
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Checkout Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentInitiating, setPaymentInitiating] = useState(false);
  const [paymentRedirectUrl, setPaymentRedirectUrl] = useState(null);
  const [verificationOrderId, setVerificationOrderId] = useState(null);

  // Success screen
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // Active bill settings
  const billSettings = getAdminPOSBillSettings();

  // Active tab shortcuts
  const activeBill = bills.find((b) => b.id === activeTab) || bills[0];
  const cart = activeBill.cart;
  const currentCustomer = activeBill.customer;

  // ── Lifecycles & Handlers ──────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchCustomers();

    // Register USB Keyboard Wedge scanner listener
    const cleanupWedge = initWedgeScanner((barcode) => {
      handleBarcodeScan(barcode);
    });

    return () => {
      cleanupWedge();
    };
  }, []);

  const fetchProducts = async (search = "") => {
    try {
      setLoading(true);
      const res = await adminPosApi.getPOSProducts({ search, limit: 100 });
      if (res.data?.success) {
        setProducts(res.data.products || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load POS products");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axiosInstance.get("/admin/categories?tree=true");
      const cats = res.data?.results || res.data?.categories || res.data?.result || [];
      setCategories(cats);
    } catch {
      // Offline/fallback categories
      setCategories([
        { _id: "herbs", name: "Herbs" },
        { _id: "spices", name: "Spices" },
        { _id: "oils", name: "Essential Oils" }
      ]);
    }
  };

  const fetchCustomers = async (search = "") => {
    try {
      const res = await adminPosApi.getCreditCustomers({ search });
      if (res.data?.success) {
        setCustomers(res.data.customers || []);
      }
    } catch {
      toast.error("Failed to load customers");
    }
  };

  // Keyboard wedge scanner event
  const handleBarcodeScan = async (barcode) => {
    try {
      toast.info(`Scanned Barcode: ${barcode}`);
      const res = await adminPosApi.getProductByBarcode(barcode);
      if (res.data?.success && res.data.product) {
        addToCart(res.data.product);
      } else {
        toast.error("Product not found for scanned barcode");
      }
    } catch {
      toast.error("Barcode lookup failed");
    }
  };

  // Camera QR/Barcode callback
  const handleCameraScan = async (text) => {
    handleBarcodeScan(text);
  };

  // Add Item to active cart
  const addToCart = (product) => {
    const lineId = getCartLineId(product.productId, product.variantId);
    
    // Check if variant has stock
    if (product.stock <= 0) {
      toast.error("Item is out of stock!");
      return;
    }

    setBills((prevBills) =>
      prevBills.map((b) => {
        if (b.id !== activeTab) return b;

        const existingItem = b.cart.find((item) => getCartLineId(item.productId, item.variantId) === lineId);
        
        if (existingItem) {
          if (existingItem.quantity + 1 > product.stock) {
            toast.error(`Only ${product.stock} units available in stock`);
            return b;
          }
          return {
            ...b,
            cart: b.cart.map((item) =>
              getCartLineId(item.productId, item.variantId) === lineId
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
          };
        }

        // Fresh cart item
        const newItem = {
          productId: product.productId,
          variantId: product.variantId,
          name: product.displayName || product.productName,
          price: product.salePrice || product.price,
          quantity: 1,
          stock: product.stock,
          gst: product.gst || 0,
          hsnCode: product.hsnCode || "",
          sku: product.sku || "",
          image: product.mainImage || "",
        };
        return {
          ...b,
          cart: [...b.cart, newItem],
        };
      })
    );
    toast.success(`${product.displayName || product.productName} added`);
  };

  const updateCartItemQty = (lineId, delta) => {
    setBills((prevBills) =>
      prevBills.map((b) => {
        if (b.id !== activeTab) return b;
        return {
          ...b,
          cart: b.cart
            .map((item) => {
              if (getCartLineId(item.productId, item.variantId) !== lineId) return item;
              const newQty = item.quantity + delta;
              if (newQty > item.stock) {
                toast.error(`Only ${item.stock} units available in stock`);
                return item;
              }
              return { ...item, quantity: newQty };
            })
            .filter((item) => item.quantity > 0),
        };
      })
    );
  };

  const removeCartItem = (lineId) => {
    setBills((prevBills) =>
      prevBills.map((b) => {
        if (b.id !== activeTab) return b;
        return {
          ...b,
          cart: b.cart.filter((item) => getCartLineId(item.productId, item.variantId) !== lineId),
        };
      })
    );
  };

  const clearActiveCart = () => {
    setBills((prevBills) =>
      prevBills.map((b) => (b.id === activeTab ? { ...b, cart: [] } : b))
    );
    toast.info("Cart cleared");
  };

  // Customer Management
  const selectCustomer = (cust) => {
    setBills((prevBills) =>
      prevBills.map((b) => (b.id === activeTab ? { ...b, customer: cust } : b))
    );
    setShowCustomerDropdown(false);
    setSearchCustomerQuery("");
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosInstance.post("/user", {
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email || undefined,
        role: "user"
      });
      if (res.data?.user) {
        toast.success("Customer added successfully");
        selectCustomer(res.data.user);
        setShowAddCustomerModal(false);
        setNewCustomer({ name: "", phone: "", email: "" });
        fetchCustomers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create customer");
    }
  };

  // Totals calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;

    cart.forEach((item) => {
      const { total, gstAmount } = calculateInclusiveGST(item.price, item.quantity, item.gst);
      subtotal += total;
      totalTax += gstAmount;
    });

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(totalTax.toFixed(2)),
      total: parseFloat(subtotal.toFixed(2)),
    };
  };

  const { subtotal, tax, total } = calculateTotals();

  // ── Checkout Actions ────────────────────────────────────────────────
  const handleProceedToPay = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (paymentMethod === "Credit" && currentCustomer._id === "walk-in-customer") {
      toast.error("Credit (Udhaar) checkout is not allowed for Walk-in Customer");
      return;
    }
    setAmountReceived(total.toString());
    setShowPaymentModal(true);
  };

  const handleCheckoutComplete = async () => {
    try {
      setLoading(true);

      const payload = {
        customerId: currentCustomer._id,
        paymentMethod,
        paymentStatus: paymentMethod === "Credit" ? "Pending" : paymentStatus,
        items: cart.map((item) => ({
          productId: item.productId,
          variationId: item.variantId,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          gst: item.gst,
          hsnCode: item.hsnCode,
          sku: item.sku,
        })),
      };

      if (paymentMethod === "Online") {
        // POS Online checkout: create session
        setPaymentInitiating(true);
        const redirectRes = await adminPosApi.createOnlineOrder({
          ...payload,
          redirectUrl: `${window.location.origin}/admin/pos/success`
        });

        if (redirectRes.data?.success) {
          setPaymentRedirectUrl(redirectRes.data.redirectUrl);
          setVerificationOrderId(redirectRes.data.order?.orderId);
          toast.success("PhonePe Payment Session Initiated. Please complete payment.");
        }
        setPaymentInitiating(false);
        return;
      }

      // Cash/Credit sale
      const res = await adminPosApi.createOrder(payload);
      if (res.data?.success) {
        toast.success("Transaction completed successfully!");
        setLastCreatedOrder(res.data.order);
        setShowPaymentModal(false);
        setShowSuccessOverlay(true);
        // Clear cart
        setBills((prevBills) =>
          prevBills.map((b) => (b.id === activeTab ? { ...b, cart: [] } : b))
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyOnlinePaymentStatus = async () => {
    if (!verificationOrderId) return;
    try {
      setLoading(true);
      const res = await adminPosApi.verifyOnlinePayment(verificationOrderId);
      if (res.data?.success) {
        toast.success("PhonePe Payment Verified Successfully!");
        setLastCreatedOrder(res.data.order);
        setShowPaymentModal(false);
        setShowSuccessOverlay(true);
        // Clear cart
        setBills((prevBills) =>
          prevBills.map((b) => (b.id === activeTab ? { ...b, cart: [] } : b))
        );
      } else {
        toast.error("Payment status is still Pending or Failed. Check customer screen.");
      }
    } catch {
      toast.error("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Receipt Generator
  const printThermalReceipt = () => {
    if (!lastCreatedOrder) return;
    window.print();
  };

  const downloadInvoicePDF = () => {
    if (!lastCreatedOrder) return;

    const doc = new jsPDF({
      format: "a4",
      unit: "mm"
    });

    // Header info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(billSettings.shopName.text || "VEENOLEX", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Address: ${billSettings.address.text}`, 14, 26);
    doc.text(`Phone: ${billSettings.phone.text}`, 14, 31);
    if (billSettings.gst.enabled) doc.text(`GSTIN: ${billSettings.gst.text}`, 14, 36);

    // Bill Details
    doc.text(`Invoice ID: ${lastCreatedOrder.orderId}`, 140, 20);
    doc.text(`Date: ${new Date(lastCreatedOrder.createdAt).toLocaleDateString()}`, 140, 25);
    doc.text(`Customer Name: ${lastCreatedOrder.customerName || "N/A"}`, 140, 30);
    doc.text(`Customer Phone: ${lastCreatedOrder.customerPhone || "N/A"}`, 140, 35);

    // Separator line
    doc.line(14, 42, 196, 42);

    // Table entries
    const tableRows = lastCreatedOrder.items.map((item, idx) => [
      idx + 1,
      item.name,
      item.hsnCode || "-",
      item.gst ? `${item.gst}%` : "0%",
      item.quantity,
      `Rs. ${item.price.toFixed(2)}`,
      `Rs. ${(item.price * item.quantity).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 46,
      head: [["#", "Item Name", "HSN", "GST", "Qty", "Rate", "Amount"]],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Subtotal: Rs. ${lastCreatedOrder.pricing.subtotal.toFixed(2)}`, 140, finalY);
    doc.text(`Total Tax: Rs. ${lastCreatedOrder.pricing.gst.toFixed(2)}`, 140, finalY + 5);
    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total: Rs. ${lastCreatedOrder.pricing.total.toFixed(2)}`, 140, finalY + 11);

    // Terms and footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (billSettings.terms.enabled) {
      doc.text("Terms & Conditions:", 14, finalY + 20);
      doc.text(billSettings.terms.text, 14, finalY + 24);
    }

    doc.save(`Invoice_${lastCreatedOrder.orderId}.pdf`);
  };

  // Filter products by selected category
  const filteredProducts = products.filter((p) => {
    if (selectedCategory === "all") return true;
    return p.categoryId === selectedCategory;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 h-auto lg:h-[calc(100vh-180px)] bg-transparent text-slate-800 lg:overflow-hidden overflow-y-auto">
      {/* ── LEFT PANEL: Catalog search & grid ────────────────────────── */}
      <div className="flex flex-col flex-1 h-[600px] lg:h-full overflow-hidden bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4">
        {/* Search header & camera button */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchProducts(e.target.value);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
          <button
            onClick={() => setIsCameraOpen(true)}
            className="flex items-center justify-center p-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-600/10"
            title="Scan with Camera"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-thin scrollbar-thumb-slate-200">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border ${
              selectedCategory === "all"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/10"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setSelectedCategory(cat._id)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all border ${
                selectedCategory === cat._id
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/10"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Catalog Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 scrollbar-thin scrollbar-thumb-slate-200">
          {loading && products.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center h-48">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
              <p className="text-slate-500 text-sm">Loading catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center h-48 text-slate-400 text-sm">
              No products found
            </div>
          ) : (
            filteredProducts.map((prod) => (
              <div
                key={getCartLineId(prod.productId, prod.variantId)}
                onClick={() => addToCart(prod)}
                className="group relative flex flex-col bg-white hover:bg-slate-50 border border-slate-100 rounded-xl overflow-hidden cursor-pointer transition-all shadow-sm min-h-[220px]"
              >
                {/* Product Image */}
                <div className="w-full aspect-square bg-slate-50 flex items-center justify-center relative overflow-hidden shrink-0">
                  {(prod.mainImage || prod.image) ? (
                    <img
                      src={prod.mainImage || prod.image}
                      alt={prod.displayName || prod.productName || prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Box className="w-8 h-8 text-slate-300" />
                  )}
                  {/* Stock Badge */}
                  <div
                    className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                      prod.stock <= 0
                        ? "bg-red-50 text-red-650 border-red-100"
                        : prod.stock <= 5
                        ? "bg-amber-50 text-amber-650 border-amber-100"
                        : "bg-emerald-50 text-emerald-650 border-emerald-100"
                    }`}
                  >
                    {prod.stock <= 0 ? "Out of Stock" : `${prod.stock} left`}
                  </div>
                </div>

                {/* Details */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 line-clamp-2 mb-1 group-hover:text-slate-900">
                      {prod.displayName || prod.productName || prod.name}
                    </h4>
                    {prod.variantName && prod.variantName !== "Default" && (
                      <span className="inline-block text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md mb-2">
                        {prod.variantName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mt-auto">
                    <span className="text-sm font-bold text-emerald-600">
                      ₹{prod.salePrice || prod.price}
                    </span>
                    {prod.compareAtPrice > (prod.salePrice || prod.price) && (
                      <span className="text-[10px] line-through text-slate-400">
                        ₹{prod.compareAtPrice}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Tabs, Cart & Checkout ──────────────────────── */}
      <div className="w-full lg:w-[420px] flex flex-col h-[600px] lg:h-full bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4">
        {/* Bill Multi-Tabs */}
        <div className="flex border-b border-slate-200 mb-4">
          {bills.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveTab(b.id)}
              className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 ${
                activeTab === b.id
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {b.name}
              {b.cart.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] rounded-full">
                  {b.cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Customer Selector */}
        <div className="relative mb-4">
          <div
            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
            className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-xl p-3 cursor-pointer hover:border-slate-350 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-slate-800">{currentCustomer.name}</p>
                <p className="text-[10px] text-slate-500">{currentCustomer.phone}</p>
              </div>
            </div>
            <Plus
              onClick={(e) => {
                e.stopPropagation();
                setShowAddCustomerModal(true);
              }}
              className="w-4 h-4 text-emerald-600 hover:text-emerald-700"
            />
          </div>

          {/* Search Dropdown list */}
          {showCustomerDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-xl mt-1 shadow-2xl p-2 max-h-48 overflow-y-auto">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchCustomerQuery}
                onChange={(e) => {
                  setSearchCustomerQuery(e.target.value);
                  fetchCustomers(e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs mb-2 text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <div
                onClick={() => selectCustomer({ _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" })}
                className="p-2 hover:bg-slate-50 rounded-md text-xs cursor-pointer text-slate-500 hover:text-slate-800"
              >
                Walk-in Customer
              </div>
              {customers.map((cust) => (
                <div
                  key={cust._id}
                  onClick={() => selectCustomer(cust)}
                  className="p-2 hover:bg-slate-50 rounded-md text-xs cursor-pointer flex justify-between items-center text-slate-650 hover:text-slate-900"
                >
                  <span>{cust.name} ({cust.phone})</span>
                  {cust.creditBalance > 0 && (
                    <span className="text-[9px] text-red-500 font-bold">₹{cust.creditBalance} due</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto pr-1 mb-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
              <ShoppingCart className="w-10 h-10 mb-2 text-slate-250" />
              Empty Cart
            </div>
          ) : (
            cart.map((item) => {
              const lineId = getCartLineId(item.productId, item.variantId);
              return (
                <div
                  key={lineId}
                  className="flex gap-3 bg-slate-50/50 border border-slate-100 rounded-xl p-3 relative hover:border-slate-200 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 bg-white border border-slate-200/80 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Box className="w-5 h-5 text-slate-300" />
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-700 truncate">{item.name}</h5>
                    <p className="text-[10px] text-slate-400 mb-1.5">GST: {item.gst}% | HSN: {item.hsnCode || "N/A"}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600">₹{item.price * item.quantity}</span>
                      {/* Quantity tools */}
                      <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-2 py-0.5">
                        <button
                          onClick={() => updateCartItemQty(lineId, -1)}
                          className="text-slate-400 hover:text-slate-650"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold text-slate-700">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItemQty(lineId, 1)}
                          className="text-slate-400 hover:text-slate-650"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeCartItem(lineId)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Totals Block */}
        <div className="border-t border-slate-100 pt-4 mt-auto">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Subtotal</span>
            <span>₹{subtotal - tax}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>GST (Inclusive)</span>
            <span>₹{tax}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-100 pt-2.5 mb-4">
            <span>Grand Total</span>
            <span className="text-emerald-600 font-extrabold text-base">₹{total}</span>
          </div>

          {/* Action Row */}
          <div className="flex gap-2">
            <button
              onClick={clearActiveCart}
              disabled={cart.length === 0}
              className="flex-1 py-3 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              Clear Cart
            </button>
            <button
              onClick={handleProceedToPay}
              disabled={cart.length === 0}
              className="flex-2 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-4 h-4" />
              Pay Bill
            </button>
          </div>
        </div>
      </div>

      {/* ── CAMERA SCANNER MODAL ────────────────────────────────────── */}
      <QRScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={handleCameraScan}
      />

      {/* ── ADD CUSTOMER MODAL ───────────────────────────────────────── */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form
            onSubmit={handleCreateCustomer}
            className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-6 text-slate-800 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-base font-bold text-slate-900">Add New Customer</h4>
              <X
                className="w-5 h-5 text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => setShowAddCustomerModal(false)}
              />
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white text-xs transition-all shadow-md shadow-emerald-600/10"
            >
              Add Customer
            </button>
          </form>
        </div>
      )}

      {/* ── PAYMENT CHECKOUT MODAL ──────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-6 text-slate-800 shadow-2xl relative">
            <X
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 w-5 h-5 text-slate-400 hover:text-slate-650 cursor-pointer"
            />
            <h3 className="text-lg font-bold text-slate-900 mb-4">Complete Payment</h3>

            {/* Total display */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center mb-6">
              <span className="text-xs text-slate-400 block mb-1">Amount Due</span>
              <span className="text-2xl font-bold text-emerald-650">₹{total}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="mb-6">
              <label className="block text-xs text-slate-500 mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {["Cash", "Credit", "Online"].map((method) => (
                  <button
                    key={method}
                    onClick={() => {
                      setPaymentMethod(method);
                      if (method === "Credit") setPaymentStatus("Pending");
                    }}
                    className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === method
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash details */}
            {paymentMethod === "Cash" && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cash Received</label>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none"
                  />
                </div>
                {Number(amountReceived) >= total && (
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Return Change:</span>
                    <span className="font-bold text-slate-800 text-sm">₹{(Number(amountReceived) - total).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Credit Warning */}
            {paymentMethod === "Credit" && (
              <div className="bg-red-50 border border-red-100 text-red-655 text-xs p-3.5 rounded-xl mb-6 flex flex-col gap-1">
                <span className="font-bold">Udhaar (Credit) Transaction</span>
                <span>Outstanding will increase for <b>{currentCustomer.name}</b> by ₹{total}.</span>
              </div>
            )}

            {/* Online payment QR loader */}
            {paymentMethod === "Online" && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-750 text-xs p-3.5 rounded-xl mb-6">
                {paymentRedirectUrl ? (
                  <div className="flex flex-col gap-3 items-center text-center">
                    <p className="font-bold">Scan QR or Complete PhonePe checkout session</p>
                    <a
                      href={paymentRedirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 font-bold rounded-lg text-white text-xs block transition-all shadow-md shadow-emerald-600/10"
                    >
                      Open Checkout Link
                    </a>
                    <button
                      onClick={verifyOnlinePaymentStatus}
                      className="mt-2 flex items-center gap-1 text-[11px] underline text-emerald-650 hover:text-emerald-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Verify Status
                    </button>
                  </div>
                ) : (
                  <p className="text-center font-bold">QR / online link will be generated below.</p>
                )}
              </div>
            )}

            {/* Confirmation actions */}
            {!paymentRedirectUrl && (
              <button
                onClick={handleCheckoutComplete}
                disabled={loading || paymentInitiating}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {paymentMethod === "Online" ? "Generate Online Link" : "Complete Transaction"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── SUCCESS PRINT OVERLAY ────────────────────────────────────── */}
      {showSuccessOverlay && lastCreatedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-6 text-slate-800 shadow-2xl text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">Order Placed Successfully!</h3>
            <p className="text-xs text-slate-400 mb-6">Invoice ID: {lastCreatedOrder.orderId}</p>

            <div className="space-y-2 mb-6">
              <button
                onClick={printThermalReceipt}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-600/10"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                onClick={downloadInvoicePDF}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold transition-all"
              >
                Download PDF
              </button>
            </div>

            <button
              onClick={() => {
                setShowSuccessOverlay(false);
                setLastCreatedOrder(null);
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider"
            >
              New Sale
            </button>
          </div>
        </div>
      )}

      {/* ── THERMAL RECEIPT EMBEDDED DOCK FOR window.print() ────────── */}
      {lastCreatedOrder && (
        <div className="hidden print:block fixed inset-0 z-50 bg-white text-black p-4 text-[12px] font-mono w-[80mm] leading-tight pos-receipt-print-area">
          <div className="text-center mb-4">
            <h2 className="text-[16px] font-bold uppercase">{billSettings.shopName.text}</h2>
            <p>{billSettings.address.text}</p>
            <p>Phone: {billSettings.phone.text}</p>
            {billSettings.gst.enabled && <p>GSTIN: {billSettings.gst.text}</p>}
            <p className="border-b border-dashed border-black my-2" />
          </div>

          <div className="mb-4">
            <p><b>Order ID:</b> {lastCreatedOrder.orderId}</p>
            <p><b>Date:</b> {new Date(lastCreatedOrder.createdAt).toLocaleString()}</p>
            <p><b>Customer:</b> {lastCreatedOrder.customerName || "Walk-in"}</p>
            {lastCreatedOrder.customerPhone && <p><b>Phone:</b> {lastCreatedOrder.customerPhone}</p>}
            <p className="border-b border-dashed border-black my-2" />
          </div>

          <table className="w-full text-left border-collapse text-[11px] mb-4">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Item</th>
                <th className="py-1 text-center">Qty</th>
                <th className="py-1 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {lastCreatedOrder.items.map((item) => (
                <tr key={item._id} className="border-b border-dashed border-zinc-200">
                  <td className="py-1">
                    {item.name}
                    {item.variantSlot && <span className="block text-[9px] text-zinc-500">({item.variantSlot})</span>}
                  </td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">₹{item.price * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-right text-[11px] mb-4">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{(lastCreatedOrder.pricing.subtotal - lastCreatedOrder.pricing.gst).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST Total:</span>
              <span>₹{lastCreatedOrder.pricing.gst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
              <span>Grand Total:</span>
              <span>₹{lastCreatedOrder.pricing.total.toFixed(2)}</span>
            </div>
            <p className="border-b border-dashed border-black my-2" />
          </div>

          <div className="text-center text-[10px] space-y-1">
            {billSettings.notes.enabled && <p>{billSettings.notes.text}</p>}
            {billSettings.terms.enabled && <p><b>Terms:</b> {billSettings.terms.text}</p>}
            <p className="mt-2 font-bold">Thank You!</p>
          </div>
        </div>
      )}
    </div>
  );
}
