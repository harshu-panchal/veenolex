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
  Box,
  Edit2,
  Check
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import axiosInstance from "@core/api/axios";
import adminPosApi from "../../services/api/posApi";
import { useLiveProductStock, liveStockFor } from "@shared/hooks/useLiveProductStock";
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
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "" });
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState({ name: "", phone: "", address: "" });
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);

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

  // Cart Item Price Editing
  const [editingLineId, setEditingLineId] = useState(null);
  const [tempPrice, setTempPrice] = useState("");

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

  const fetchProducts = async (search = "", { quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      const res = await adminPosApi.getPOSProducts({ search, limit: 100 });
      if (res.data?.success) {
        setProducts(res.data.products || []);
      }
    } catch (err) {
      if (!quiet) toast.error(err.response?.data?.message || "Failed to load POS products");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // Show the stock left right after a bill (from the server's response),
  // then reload the list in the background to pick up any other changes.
  const applyStockUpdates = (stockUpdates = []) => {
    if (stockUpdates.length) {
      const remainingFor = (productId, variantId) => {
        let remaining = null;
        for (const update of stockUpdates) {
          if (update.productId !== productId) continue;
          if (update.variantId && variantId && update.variantId !== variantId) continue;
          remaining = update.remaining;
        }
        return remaining;
      };
      setProducts((prev) =>
        prev.map((row) => {
          const remaining = remainingFor(row.productId, row.variantId);
          return remaining === null ? row : { ...row, stock: remaining };
        })
      );
      setBills((prevBills) =>
        prevBills.map((b) => ({
          ...b,
          cart: b.cart.map((item) => {
            const remaining = remainingFor(item.productId, item.variantId);
            return remaining === null ? item : { ...item, stock: remaining };
          }),
        }))
      );
      const summary = stockUpdates
        .map((u) => `${u.name}: ${u.remaining} left`)
        .join(", ");
      toast.info(`Stock updated — ${summary}`);
    }
    fetchProducts(searchQuery, { quiet: true });
  };

  // Stock changed somewhere else (website order, another till, reroute,
  // product edit): patch the tiles and carts in place without a toast.
  useLiveProductStock(
    (updates) => {
      const patch = (row) => {
        const stock = liveStockFor(updates, row.productId, row.variantId);
        return stock === null || stock === row.stock ? row : { ...row, stock };
      };
      setProducts((prev) => prev.map(patch));
      setBills((prev) => prev.map((b) => ({ ...b, cart: b.cart.map(patch) })));
    },
    () => fetchProducts(searchQuery, { quiet: true })
  );

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
        const unitPrice = product.salePrice || product.price;
        const newItem = {
          productId: product.productId,
          variantId: product.variantId,
          name: product.displayName || product.productName,
          price: unitPrice,
          originalPrice: unitPrice,
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

  const updateCartItemPrice = (lineId, newPrice) => {
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setBills((prevBills) =>
      prevBills.map((b) => {
        if (b.id !== activeTab) return b;
        return {
          ...b,
          cart: b.cart.map((item) => {
            if (getCartLineId(item.productId, item.variantId) !== lineId) return item;
            return { ...item, price: parsedPrice };
          }),
        };
      })
    );
    setEditingLineId(null);
    setTempPrice("");
    toast.success("Price updated");
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
      const res = await adminPosApi.createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone,
        address: newCustomer.address ? newCustomer.address.trim() : undefined,
      });
      const customer = res.data?.customer || res.data?.user;
      if (customer) {
        toast.success("Customer added successfully");
        selectCustomer(customer);
        setShowAddCustomerModal(false);
        setNewCustomer({ name: "", phone: "", address: "" });
        fetchCustomers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create customer");
    }
  };

  const openEditCustomerModal = () => {
    const custAddr =
      currentCustomer.address ||
      currentCustomer.location?.address ||
      currentCustomer.addresses?.[0]?.fullAddress ||
      "";
    setEditCustomer({
      name: currentCustomer.name || "",
      phone: currentCustomer.phone === "0000000000" ? "" : (currentCustomer.phone || ""),
      address: custAddr === "POS Order" ? "" : custAddr,
    });
    setShowEditCustomerModal(true);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    try {
      setIsUpdatingCustomer(true);
      const isRegistered = currentCustomer._id && currentCustomer._id !== "walk-in-customer";

      if (isRegistered) {
        const res = await adminPosApi.updateCustomer(currentCustomer._id, {
          name: editCustomer.name.trim() || undefined,
          phone: editCustomer.phone.trim() || undefined,
          address: editCustomer.address.trim(),
        });

        const updated = res.data?.customer || res.data?.user;
        if (updated) {
          toast.success("Customer details updated successfully");
          setBills((prevBills) =>
            prevBills.map((b) =>
              b.id === activeTab
                ? {
                    ...b,
                    customer: {
                      ...b.customer,
                      ...updated,
                      address: editCustomer.address.trim(),
                    },
                  }
                : b
            )
          );
          fetchCustomers();
        }
      } else {
        // Walk-in customer: update current bill customer info
        setBills((prevBills) =>
          prevBills.map((b) =>
            b.id === activeTab
              ? {
                  ...b,
                  customer: {
                    ...b.customer,
                    name: editCustomer.name.trim() || "Walk-in Customer",
                    phone: editCustomer.phone.trim() || "0000000000",
                    address: editCustomer.address.trim(),
                  },
                }
              : b
          )
        );
        toast.success("Customer details updated for this bill");
      }

      setShowEditCustomerModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update customer details");
    } finally {
      setIsUpdatingCustomer(false);
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

      const customerAddress =
        currentCustomer.address ||
        currentCustomer.location?.address ||
        currentCustomer.addresses?.[0]?.fullAddress ||
        currentCustomer.addresses?.[0]?.formattedAddress ||
        "";

      const payload = {
        customerId: currentCustomer._id,
        paymentMethod,
        paymentStatus: paymentMethod === "Credit" ? "Pending" : paymentStatus,
        customerAddress,
        address: {
          name: currentCustomer.name || "POS Customer",
          phone: currentCustomer.phone || "",
          address: customerAddress || "POS Order",
        },
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
        applyStockUpdates(res.data.stockUpdates);
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
        if (res.data.stockError) {
          toast.warning(`Paid, but stock was not reduced: ${res.data.stockError}. Please adjust it manually.`);
        }
        applyStockUpdates(res.data.stockUpdates);
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

    const custAddr =
      lastCreatedOrder.customerAddress ||
      (lastCreatedOrder.address?.address && lastCreatedOrder.address.address !== "POS Order" ? lastCreatedOrder.address.address : "") ||
      lastCreatedOrder.address?.fullAddress ||
      "";

    let nextY = 40;
    if (custAddr) {
      const wrappedAddr = doc.splitTextToSize(`Address: ${custAddr}`, 56);
      doc.text(wrappedAddr, 140, nextY);
      nextY += wrappedAddr.length * 4.5;
    }

    const separatorY = Math.max(42, nextY + 2);

    // Separator line
    doc.line(14, separatorY, 196, separatorY);

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
      startY: separatorY + 4,
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
            <div className="flex items-center gap-2.5 min-w-0">
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{currentCustomer.name}</p>
                <p className="text-[10px] text-slate-500">{currentCustomer.phone}</p>
                {(currentCustomer.address || currentCustomer.location?.address || currentCustomer.addresses?.[0]?.fullAddress) ? (
                  <p
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditCustomerModal();
                    }}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 underline underline-offset-2 decoration-emerald-300 truncate max-w-[200px] cursor-pointer"
                    title={currentCustomer.address || currentCustomer.location?.address || currentCustomer.addresses?.[0]?.fullAddress}
                  >
                    📍 {currentCustomer.address || currentCustomer.location?.address || currentCustomer.addresses?.[0]?.fullAddress}
                  </p>
                ) : (
                  <p
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditCustomerModal();
                    }}
                    className="text-[10px] text-slate-400 hover:text-emerald-600 cursor-pointer flex items-center gap-1 mt-0.5"
                  >
                    <Edit2 className="w-2.5 h-2.5" /> Add Address
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                title="Edit Address & Phone"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditCustomerModal();
                }}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                type="button"
                title="Add New Customer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddCustomerModal(true);
                }}
                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
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
              {customers.map((cust) => {
                const custAddr = cust.address || cust.location?.address || cust.addresses?.[0]?.fullAddress || "";
                return (
                  <div
                    key={cust._id}
                    onClick={() => selectCustomer(cust)}
                    className="p-2 hover:bg-slate-50 rounded-md text-xs cursor-pointer flex justify-between items-center text-slate-650 hover:text-slate-900"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold">{cust.name} ({cust.phone})</span>
                      {custAddr && (
                        <span className="block text-[10px] text-slate-400 truncate max-w-[220px]">
                          📍 {custAddr}
                        </span>
                      )}
                    </div>
                    {cust.creditBalance > 0 && (
                      <span className="text-[9px] text-red-500 font-bold shrink-0">₹{cust.creditBalance} due</span>
                    )}
                  </div>
                );
              })}
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
                    <div className="flex items-center justify-between gap-2 mt-1">
                      {editingLineId === lineId ? (
                        <div className="flex items-center gap-1 bg-white border border-emerald-400 rounded-lg px-1.5 py-0.5 shadow-sm">
                          <span className="text-xs text-slate-500 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            autoFocus
                            value={tempPrice}
                            onChange={(e) => setTempPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                updateCartItemPrice(lineId, tempPrice);
                              } else if (e.key === "Escape") {
                                setEditingLineId(null);
                                setTempPrice("");
                              }
                            }}
                            className="w-16 px-1 py-0.5 text-xs font-bold text-slate-800 focus:outline-none"
                            placeholder="Price"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartItemPrice(lineId, tempPrice)}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                            title="Save price"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLineId(null);
                              setTempPrice("");
                            }}
                            className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group/price">
                          <span className="text-xs font-bold text-emerald-600">
                            ₹{item.price * item.quantity}
                            {item.quantity > 1 && (
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                (₹{item.price}/ea)
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLineId(lineId);
                              setTempPrice(String(item.price));
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Edit unit price"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Quantity tools */}
                      <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-2 py-0.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(lineId, -1)}
                          className="text-slate-400 hover:text-slate-650"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold text-slate-700">{item.quantity}</span>
                        <button
                          type="button"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleCreateCustomer}
            className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 text-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto my-auto"
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
                <label className="block text-xs text-slate-500 mb-1">Address (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Enter street address, city, area..."
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none resize-none"
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

      {/* ── EDIT CUSTOMER MODAL ───────────────────────────────────────── */}
      {showEditCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleUpdateCustomer}
            className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 text-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto my-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">Edit Customer Details</h4>
                <p className="text-[11px] text-slate-400">Update phone number and address</p>
              </div>
              <X
                className="w-5 h-5 text-slate-400 hover:text-slate-600 cursor-pointer"
                onClick={() => setShowEditCustomerModal(false)}
              />
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editCustomer.name}
                  onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={editCustomer.phone}
                  onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
                <textarea
                  rows={3}
                  placeholder="Enter full address, city, landmark..."
                  value={editCustomer.address}
                  onChange={(e) => setEditCustomer({ ...editCustomer, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEditCustomerModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingCustomer}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-white text-xs transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-1.5"
              >
                {isUpdatingCustomer ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── PAYMENT CHECKOUT MODAL ──────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 text-slate-800 shadow-2xl relative max-h-[92vh] flex flex-col my-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Complete Payment</h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close payment modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body Container */}
            <div className="overflow-y-auto pr-1 space-y-4 flex-1">
              {/* Total display */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 sm:p-4 text-center">
                <span className="text-xs text-slate-400 block mb-0.5">Amount Due</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">₹{total}</span>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Cash", "Credit"].map((method) => (
                    <button
                      type="button"
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        if (method === "Credit") setPaymentStatus("Pending");
                      }}
                      className={`py-2.5 sm:py-3 rounded-xl border text-xs font-bold transition-all ${
                        paymentMethod === method
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
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
                <div className="space-y-3 bg-slate-50/60 p-3 sm:p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Cash Received</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 sm:py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  {Number(amountReceived) >= total && (
                    <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                      <span className="font-medium">Return Change:</span>
                      <span className="font-extrabold text-emerald-700 text-sm">₹{(Number(amountReceived) - total).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Credit Warning */}
              {paymentMethod === "Credit" && (
                <div className="bg-red-50 border border-red-100 text-red-655 text-xs p-3.5 rounded-xl flex flex-col gap-1">
                  <span className="font-bold">Udhaar (Credit) Transaction</span>
                  <span>Outstanding will increase for <b>{currentCustomer.name}</b> by ₹{total}.</span>
                </div>
              )}
            </div>

            {/* Dedicated Sticky Footer: ALWAYS VISIBLE */}
            <div className="pt-3 mt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleCheckoutComplete}
                disabled={loading || paymentInitiating}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/15 active:scale-98 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Complete Transaction
              </button>
            </div>
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
            {(lastCreatedOrder.customerAddress || (lastCreatedOrder.address?.address && lastCreatedOrder.address.address !== "POS Order")) && (
              <p className="break-words">
                <b>Address:</b> {lastCreatedOrder.customerAddress || lastCreatedOrder.address?.address}
              </p>
            )}
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
