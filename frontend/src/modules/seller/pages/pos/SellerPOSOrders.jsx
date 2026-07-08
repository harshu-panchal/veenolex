import { useState, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Plus,
  Trash2,
  Minus,
  Camera,
  CreditCard,
  RefreshCw,
  Printer,
  X,
  CheckCircle,
  Box
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import "jspdf-autotable";

import { sellerApi } from "../../services/sellerApi";
import { getCartLineId } from "../../../../utils/posCartLineId";
import { expandPOSProducts } from "../../../../utils/posProductExpansion";
import { calculateInclusiveGST } from "../../../../utils/gstUtils";
import { initWedgeScanner } from "../../../../utils/scannerPlatform";
import QRScannerModal from "../../../../components/QRScannerModal";
import axiosInstance from "@core/api/axios";

export default function SellerPOSOrders() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Multi-bill state (synced with Server)
  const [bills, setBills] = useState([
    { id: 1, name: "Tab 1", cart: [], customer: { _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" } },
    { id: 2, name: "Tab 2", cart: [], customer: { _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" } },
    { id: 3, name: "Tab 3", cart: [], customer: { _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" } },
  ]);
  const [activeTab, setActiveTab] = useState(1);

  // Customer state
  const [customers, setCustomers] = useState([]);
  const [searchCustomerQuery, setSearchCustomerQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });

  // Camera & payment
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [verificationOrderId, setVerificationOrderId] = useState(null);

  // Success overlay
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [billSettings, setBillSettings] = useState({});

  const activeBill = bills.find((b) => b.id === activeTab) || bills[0];
  const cart = activeBill.cart;
  const currentCustomer = activeBill.customer;

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchCustomers();
    fetchBillSettings();
    fetchPOSState();

    const cleanupWedge = initWedgeScanner((barcode) => {
      handleBarcodeScan(barcode);
    });

    return () => {
      cleanupWedge();
    };
  }, []);

  // Debounced server sync of multi-bill state
  useEffect(() => {
    if (bills.length > 0) {
      const delayDebounce = setTimeout(() => {
        syncPOSState();
      }, 500);
      return () => clearTimeout(delayDebounce);
    }
  }, [bills, activeTab]);

  const fetchProducts = async (search = "") => {
    try {
      setLoading(true);
      const res = await sellerApi.sellerPos.getPOSProducts({ search, limit: 100 });
      if (res.data?.success) {
        setProducts(res.data.products || []);
      }
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await sellerApi.getCategories();
      const cats = res.data?.results || res.data?.categories || res.data?.result || [];
      setCategories(cats);
    } catch {
      // Ignore fallback
    }
  };

  const fetchCustomers = async (search = "") => {
    try {
      const res = await sellerApi.sellerPos.getPOSCustomers({ search });
      if (res.data?.success) {
        setCustomers(res.data.customers || []);
      }
    } catch {
      // Ignore
    }
  };

  const fetchBillSettings = async () => {
    try {
      const res = await sellerApi.sellerPos.getBillSettings();
      if (res.data?.success) {
        setBillSettings(res.data.billSettings || {});
      }
    } catch {
      // Ignore
    }
  };

  const fetchPOSState = async () => {
    try {
      const res = await sellerApi.sellerPos.getState();
      if (res.data?.success && res.data.state?.bills?.length > 0) {
        setBills(res.data.state.bills);
        setActiveTab(res.data.state.activeBillIndex || 1);
      }
    } catch {
      // Use defaults
    }
  };

  const syncPOSState = async () => {
    try {
      await sellerApi.sellerPos.updateState({
        bills,
        activeBillIndex: activeTab,
      });
    } catch {
      // Fail silently
    }
  };

  const handleBarcodeScan = async (barcode) => {
    try {
      toast.info(`Scanned Barcode: ${barcode}`);
      const res = await axiosInstance.get(`/products/pos/barcode?code=${barcode}`);
      if (res.data?.success && res.data.product) {
        addToCart(res.data.product);
      } else {
        toast.error("Product not found");
      }
    } catch {
      toast.error("Barcode lookup failed");
    }
  };

  const handleCameraScan = async (text) => {
    handleBarcodeScan(text);
  };

  const addToCart = (product) => {
    const lineId = getCartLineId(product.productId, product.variantId);
    if (product.stock <= 0) {
      toast.error("Item out of stock!");
      return;
    }

    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== activeTab) return b;
        const existing = b.cart.find((i) => getCartLineId(i.productId, i.variantId) === lineId);
        if (existing) {
          if (existing.quantity + 1 > product.stock) {
            toast.error("Insufficient stock");
            return b;
          }
          return {
            ...b,
            cart: b.cart.map((i) =>
              getCartLineId(i.productId, i.variantId) === lineId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          };
        }
        return {
          ...b,
          cart: [
            ...b.cart,
            {
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
            },
          ],
        };
      })
    );
    toast.success("Added to cart");
  };

  const updateCartItemQty = (lineId, delta) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== activeTab) return b;
        return {
          ...b,
          cart: b.cart
            .map((item) => {
              if (getCartLineId(item.productId, item.variantId) !== lineId) return item;
              const newQty = item.quantity + delta;
              if (newQty > item.stock) {
                toast.error("Insufficient stock");
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
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== activeTab) return b;
        return {
          ...b,
          cart: b.cart.filter((item) => getCartLineId(item.productId, item.variantId) !== lineId),
        };
      })
    );
  };

  const selectCustomer = (cust) => {
    setBills((prev) =>
      prev.map((b) => (b.id === activeTab ? { ...b, customer: cust } : b))
    );
    setShowCustomerDropdown(false);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await sellerApi.sellerPos.createPOSCustomer(newCustomer);
      if (res.data?.success) {
        toast.success("Customer registered");
        selectCustomer(res.data.customer);
        setShowAddCustomerModal(false);
        setNewCustomer({ name: "", phone: "", email: "" });
        fetchCustomers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add customer");
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    cart.forEach((i) => {
      const { total, gstAmount } = calculateInclusiveGST(i.price, i.quantity, i.gst);
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

  const handleProceedToPay = () => {
    if (cart.length === 0) return;
    if (paymentMethod === "Credit" && currentCustomer._id === "walk-in-customer") {
      toast.error("Udhaar not allowed for Walk-in Customer");
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
        items: cart.map((i) => ({
          productId: i.productId,
          variationId: i.variantId,
          quantity: i.quantity,
          price: i.price,
          name: i.name,
          gst: i.gst,
          hsnCode: i.hsnCode,
          sku: i.sku,
        })),
      };

      if (paymentMethod === "Online") {
        // PhonePe initiation
        const redirectRes = await axiosInstance.post("/seller/pos/orders/online", {
          ...payload,
          redirectUrl: `${window.location.origin}/seller/pos/success`,
        });
        if (redirectRes.data?.success) {
          setPaymentUrl(redirectRes.data.redirectUrl);
          setVerificationOrderId(redirectRes.data.order?.orderId);
          toast.success("PhonePe transaction created");
        }
        return;
      }

      const res = await sellerApi.sellerPos.createOrder(payload);
      if (res.data?.success) {
        toast.success("Transaction Complete");
        setLastCreatedOrder(res.data.order);
        setShowPaymentModal(false);
        setShowSuccessOverlay(true);
        setBills((prev) => prev.map((b) => (b.id === activeTab ? { ...b, cart: [] } : b)));
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
      const res = await axiosInstance.post("/seller/pos/orders/verify", { orderId: verificationOrderId });
      if (res.data?.success) {
        toast.success("Payment Received!");
        setLastCreatedOrder(res.data.order);
        setShowPaymentModal(false);
        setShowSuccessOverlay(true);
        setBills((prev) => prev.map((b) => (b.id === activeTab ? { ...b, cart: [] } : b)));
      } else {
        toast.error("Verification pending or failed");
      }
    } catch {
      toast.error("Failed to verify payment status");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === "all") return true;
    return p.categoryId === selectedCategory;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 h-auto lg:h-[calc(100vh-180px)] bg-transparent text-slate-800 lg:overflow-hidden overflow-y-auto">
      {/* Catalog */}
      <div className="flex flex-col flex-1 h-[600px] lg:h-full overflow-hidden bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search catalog..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchProducts(e.target.value);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
          <button
            onClick={() => setIsCameraOpen(true)}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-600/10 text-white"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>

        {/* Categories horizontal list */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all border ${
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all border ${
                selectedCategory === cat._id
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/10"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 scrollbar-thin scrollbar-thumb-slate-200">
          {loading && products.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center h-48">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
              <p className="text-slate-500 text-sm font-medium">Loading catalog...</p>
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

      {/* Cart & Billing info */}
      <div className="w-full lg:w-[380px] flex flex-col h-[600px] lg:h-full bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4">
        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-4">
          {bills.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveTab(b.id)}
              className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 ${
                activeTab === b.id ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Customer select */}
        <div className="relative mb-4">
          <div
            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
            className="flex justify-between items-center bg-slate-50 border border-slate-200/60 rounded-xl p-3 cursor-pointer hover:border-slate-350 transition-colors"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-slate-800">{currentCustomer.name}</p>
                <p className="text-[10px] text-slate-500">{currentCustomer.phone}</p>
              </div>
            </div>
            <Plus onClick={(e) => { e.stopPropagation(); setShowAddCustomerModal(true); }} className="w-4 h-4 text-emerald-600 hover:text-emerald-750" />
          </div>

          {showCustomerDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-xl mt-1 shadow-2xl p-2 max-h-48 overflow-y-auto">
              <input
                type="text"
                placeholder="Search..."
                value={searchCustomerQuery}
                onChange={(e) => { setSearchCustomerQuery(e.target.value); fetchCustomers(e.target.value); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs mb-2 text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <div
                onClick={() => selectCustomer({ _id: "walk-in-customer", name: "Walk-in Customer", phone: "0000000000" })}
                className="p-2 hover:bg-slate-50 rounded-md text-xs cursor-pointer text-slate-500 hover:text-slate-850"
              >
                Walk-in Customer
              </div>
              {customers.map((c) => (
                <div
                  key={c._id}
                  onClick={() => selectCustomer(c)}
                  className="p-2 hover:bg-slate-50 rounded-md text-xs cursor-pointer flex justify-between text-slate-650 hover:text-slate-900"
                >
                  <span>{c.name} ({c.phone})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Cart */}
        <div className="flex-1 overflow-y-auto space-y-3.5 mb-4 scrollbar-none">
          {cart.map((item) => {
            const lineId = getCartLineId(item.productId, item.variantId);
            return (
              <div key={lineId} className="flex gap-2.5 bg-slate-50/50 border border-slate-100 rounded-xl p-3 relative hover:border-slate-200 transition-colors">
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-700 truncate">{item.name}</h5>
                  <p className="text-[10px] text-slate-400">Rate: ₹{item.price}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold text-emerald-600">₹{item.price * item.quantity}</span>
                    <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-2 py-0.5">
                      <button onClick={() => updateCartItemQty(lineId, -1)} className="text-slate-400 hover:text-slate-650">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-semibold text-slate-700">{item.quantity}</span>
                      <button onClick={() => updateCartItemQty(lineId, 1)} className="text-slate-400 hover:text-slate-650">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => removeCartItem(lineId)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="border-t border-slate-100 pt-4 mt-auto">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Subtotal</span>
            <span>₹{subtotal - tax}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Tax (GST)</span>
            <span>₹{tax}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-100 pt-2 mb-4">
            <span>Grand Total</span>
            <span className="text-emerald-600 font-extrabold text-base">₹{total}</span>
          </div>

          <button
            onClick={handleProceedToPay}
            disabled={cart.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" />
            Proceed to Payment
          </button>
        </div>
      </div>

      <QRScannerModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onScan={handleCameraScan} />

      {/* Add Customer Modal */}
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

      {/* Checkout Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-6 text-slate-800 shadow-2xl relative">
            <X onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 w-5 h-5 text-slate-400 hover:text-slate-650 cursor-pointer" />
            <h3 className="text-base font-bold text-slate-900 mb-4">Select Payment Mode</h3>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center mb-6">
              <span className="text-[10px] text-slate-400 block mb-1">Total Due</span>
              <span className="text-xl font-bold text-emerald-650">₹{total}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {["Cash", "Credit", "Online"].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    paymentMethod === m ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {paymentMethod === "Cash" && (
              <div className="space-y-4 mb-6">
                <input
                  type="number"
                  placeholder="Cash Received"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
            )}

            {paymentMethod === "Online" && paymentUrl && (
              <div className="text-center py-4 bg-emerald-50 border border-emerald-100 text-emerald-750 rounded-xl mb-6 space-y-3">
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg text-white text-xs shadow-md shadow-emerald-600/10"
                >
                  Open PhonePe link
                </a>
                <button onClick={verifyOnlinePaymentStatus} className="text-xs text-emerald-650 hover:text-emerald-750 underline block mx-auto">
                  Verify Status
                </button>
              </div>
            )}

            {!paymentUrl && (
              <button
                onClick={handleCheckoutComplete}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold text-xs shadow-lg shadow-emerald-600/10 transition-all"
              >
                {paymentMethod === "Online" ? "Initiate Payment" : "Complete Invoice"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {showSuccessOverlay && lastCreatedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-6 text-center text-slate-800 shadow-2xl">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4 animate-bounce" />
            <h3 className="text-base font-bold text-slate-900">Order Confirmed!</h3>
            <p className="text-xs text-slate-400 mb-6">Invoice ID: {lastCreatedOrder.orderId}</p>

            <button
              onClick={() => window.print()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>

            <button
              onClick={() => { setShowSuccessOverlay(false); setLastCreatedOrder(null); }}
              className="mt-4 text-xs font-bold text-emerald-650 hover:text-emerald-750 uppercase tracking-wider block mx-auto"
            >
              New Transaction
            </button>
          </div>
        </div>
      )}

      {/* ── THERMAL RECEIPT EMBEDDED DOCK FOR window.print() ────────── */}
      {lastCreatedOrder && (
        <div className="hidden print:block fixed inset-0 z-50 bg-white text-black p-4 text-[12px] font-mono w-[80mm] leading-tight pos-receipt-print-area">
          <div className="text-center mb-4">
            <h2 className="text-[16px] font-bold uppercase">
              {billSettings?.shopName?.text || "VEENOLEX HERBS & SPICES"}
            </h2>
            <p>{billSettings?.address?.text || "123, Organic Market Lane, Sector 5"}</p>
            <p>Phone: {billSettings?.phone?.text || "+91 98765 43210"}</p>
            {billSettings?.gst?.enabled && billSettings?.gst?.text && (
              <p>GSTIN: {billSettings.gst.text}</p>
            )}
            <p className="border-b border-dashed border-black my-2" />
          </div>

          <div className="mb-4">
            <p><b>Order ID:</b> {lastCreatedOrder.orderId}</p>
            <p><b>Date:</b> {lastCreatedOrder.createdAt ? new Date(lastCreatedOrder.createdAt).toLocaleString() : new Date().toLocaleString()}</p>
            <p><b>Customer:</b> {lastCreatedOrder.customerName || "Walk-in Customer"}</p>
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
              {lastCreatedOrder.items?.map((item) => (
                <tr key={item._id || item.productId || item.name} className="border-b border-dashed border-zinc-200">
                  <td className="py-1">
                    {item.name}
                    {(item.variantSlot || item.variantName) && (
                      <span className="block text-[9px] text-zinc-500">({item.variantSlot || item.variantName})</span>
                    )}
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
              <span>
                ₹{((lastCreatedOrder.pricing?.subtotal || 0) - (lastCreatedOrder.pricing?.gst || 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>GST Total:</span>
              <span>₹{(lastCreatedOrder.pricing?.gst || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
              <span>Grand Total:</span>
              <span>₹{(lastCreatedOrder.pricing?.total || 0).toFixed(2)}</span>
            </div>
            <p className="border-b border-dashed border-black my-2" />
          </div>

          <div className="text-center text-[10px] space-y-1">
            {billSettings?.notes?.enabled && billSettings?.notes?.text && <p>{billSettings.notes.text}</p>}
            {billSettings?.terms?.enabled && billSettings?.terms?.text && (
              <p><b>Terms:</b> {billSettings.terms.text}</p>
            )}
            <p className="mt-2 font-bold">Thank You!</p>
          </div>
        </div>
      )}
    </div>
  );
}
