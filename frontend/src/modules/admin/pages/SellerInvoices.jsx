import React, { useState, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Pagination from "@shared/components/ui/Pagination";
import {
  HiOutlineBuildingOffice2,
  HiOutlineMagnifyingGlass,
  HiOutlineArrowDownTray,
  HiOutlineDocumentText,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineCalendar,
  HiOutlineCreditCard,
  HiOutlineUser,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineArrowPath,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { adminApi } from "../services/adminApi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getAllSellerRequests } from "../../../services/sellerProductRequestService";

const currency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SellerInvoices() {
  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [activeTab, setActiveTab] = useState("stock"); // "stock" | "order"

  // Data lists
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Loading states
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Refill delivery requests lists
  const [refillRequests, setRefillRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loadingRefills, setLoadingRefills] = useState(false);

  // All catalog products list
  const [allProducts, setAllProducts] = useState([]);

  // Load all catalog products on mount
  useEffect(() => {
    async function loadAllCatalogProducts() {
      try {
        const res = await adminApi.getProducts({ limit: 500 });
        const list = res.data?.result?.items || res.data?.data?.results || res.data?.results || res.data?.products || res.data?.items || [];
        if (Array.isArray(list)) {
          setAllProducts(list);
        }
      } catch (err) {
        console.error("Failed to load catalog products", err);
      }
    }
    loadAllCatalogProducts();
  }, []);

  // Load all sellers on mount
  useEffect(() => {
    async function loadSellers() {
      setLoadingSellers(true);
      try {
        const res = await adminApi.getSellers();
        const rawList = res.data?.results || res.data?.result || res.data || [];
        const list = (Array.isArray(rawList) ? rawList : []).map((seller) => {
          const joinedAt = seller.createdAt || seller.joinedAt || seller.joinedDate;
          return {
            ...seller,
            joinedDate: joinedAt
              ? new Date(joinedAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "N/A",
            avatar:
              seller.avatar ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                seller.shopName || seller.ownerName || seller.email || "seller",
              )}`,
            ownerName: seller.name || seller.ownerName || "N/A",
            locationLabel: seller.address || seller.locationLabel || "Location not set",
          };
        });
        setSellers(list);
        if (list.length > 0) {
          setSelectedSellerId(list[0]._id);
        }
      } catch (err) {
        toast.error("Failed to load sellers");
        console.error(err);
      } finally {
        setLoadingSellers(false);
      }
    }
    loadSellers();
  }, []);

  // Update selected seller object
  useEffect(() => {
    if (selectedSellerId) {
      const match = sellers.find(s => s._id === selectedSellerId);
      setSelectedSeller(match || null);

      // Reset dependent selections
      setProducts([]);
      setOrders([]);
      setSelectedOrderId("");
      setSelectedOrder(null);
      setRefillRequests([]);
      setSelectedRequestId("");
      setSelectedRequest(null);

      // Load selected seller's products, orders, and refill requests
      loadSellerProducts(selectedSellerId);
      loadSellerOrders(selectedSellerId);
      loadSellerRefills(selectedSellerId);
    } else {
      setSelectedSeller(null);
      setProducts([]);
      setOrders([]);
      setSelectedOrderId("");
      setSelectedOrder(null);
      setRefillRequests([]);
      setSelectedRequestId("");
      setSelectedRequest(null);
    }
  }, [selectedSellerId, sellers]);

  // Load products for selected seller
  const loadSellerProducts = async (sellerId) => {
    setLoadingProducts(true);
    try {
      const res = await adminApi.getProducts({ sellerId, limit: 100 });
      setProducts(res.data?.result?.items || res.data?.data?.results || res.data?.results || res.data?.products || []);
    } catch (err) {
      toast.error("Failed to load seller products");
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load orders for selected seller
  const loadSellerOrders = async (sellerId) => {
    setLoadingOrders(true);
    try {
      // Use the newly extended filter capability in backend order queries
      const res = await adminApi.getOrders({ sellerId, limit: 100 });
      const orderList = res.data?.result?.items || res.data?.data?.items || res.data?.results?.items || res.data?.items || [];
      setOrders(orderList);
      if (orderList.length > 0) {
        setSelectedOrderId(orderList[0].orderId);
        setSelectedOrder(orderList[0]);
      }
    } catch (err) {
      toast.error("Failed to load seller orders");
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load refill requests for selected seller
  const loadSellerRefills = async (sellerId) => {
    setLoadingRefills(true);
    try {
      const res = await getAllSellerRequests({ sellerId, limit: 100 });
      const refillList = Array.isArray(res.data) ? res.data : (res.data?.data || res.data || []);
      // Filter to only show requests that have been processed/delivered to seller if needed
      // User says: "which products is delivered to seller", so we show status: "DELIVERED"
      // Wait, let's keep all requests but filter or show delivered requests. 
      // To be safe, let's filter for requests with status "DELIVERED" to show only delivered ones.
      const deliveredList = refillList.filter(r => r.status === "DELIVERED");
      setRefillRequests(deliveredList);
      if (deliveredList.length > 0) {
        setSelectedRequestId(deliveredList[0].requestNumber || deliveredList[0]._id);
        setSelectedRequest(deliveredList[0]);
      }
    } catch (err) {
      toast.error("Failed to load seller refill requests");
      console.error(err);
    } finally {
      setLoadingRefills(false);
    }
  };

  // Update selected refill request object when selectedRequestId changes
  const handleRefillChange = (reqId) => {
    setSelectedRequestId(reqId);
    const match = refillRequests.find(r => (r.requestNumber === reqId || r._id === reqId));
    setSelectedRequest(match || null);
  };

  // Update selected order object when orderId is chosen
  const handleOrderChange = (orderId) => {
    setSelectedOrderId(orderId);
    const match = orders.find(o => o.orderId === orderId);
    setSelectedOrder(match || null);
  };

  // --- MANUAL INVOICE STATE & HANDLERS ---
  const generateReceiptId = () =>
    `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const [manualForm, setManualForm] = useState({
    receiptId: generateReceiptId(),
    orderDate: new Date().toISOString().slice(0, 16),
    // Seller Details (Editable)
    sellerShopName: "",
    sellerOwnerName: "",
    sellerPhone: "",
    sellerEmail: "",
    sellerAddress: "",
    sellerGst: "",
    // Customer Details (Editable)
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerGst: "",
    // Items List
    items: [
      { id: 1, name: "BODY CLEANSER", qty: 1, price: 50 }
    ],
    // Pricing Breakdown
    deliveryFee: 0,
    gstRate: 0,
    discount: 0,
    // Transaction Info
    paymentMethod: "CASH",
    orderStatus: "PAID",
  });

  // Pre-fill seller details into manualForm when selectedSeller updates
  useEffect(() => {
    if (selectedSeller) {
      setManualForm((prev) => ({
        ...prev,
        sellerShopName: prev.sellerShopName || selectedSeller.shopName || "",
        sellerOwnerName: prev.sellerOwnerName || selectedSeller.ownerName || "",
        sellerPhone: prev.sellerPhone || selectedSeller.phone || "",
        sellerEmail: prev.sellerEmail || selectedSeller.email || "",
        sellerAddress: prev.sellerAddress || selectedSeller.locationLabel || selectedSeller.address || "",
        sellerGst: prev.sellerGst || selectedSeller.gstNo || selectedSeller.gstin || "",
      }));
    }
  }, [selectedSeller]);

  const handleResetManualForm = () => {
    setManualForm({
      receiptId: generateReceiptId(),
      orderDate: new Date().toISOString().slice(0, 16),
      sellerShopName: selectedSeller?.shopName || "",
      sellerOwnerName: selectedSeller?.ownerName || "",
      sellerPhone: selectedSeller?.phone || "",
      sellerEmail: selectedSeller?.email || "",
      sellerAddress: selectedSeller?.locationLabel || selectedSeller?.address || "",
      sellerGst: selectedSeller?.gstNo || selectedSeller?.gstin || "",
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      customerGst: "",
      items: [{ id: Date.now(), name: "", qty: 1, price: 0 }],
      deliveryFee: 0,
      gstRate: 0,
      discount: 0,
      paymentMethod: "CASH",
      orderStatus: "PAID",
    });
    toast.success("Manual invoice form reset");
  };

  const handleAddManualItem = () => {
    setManualForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { id: Date.now() + Math.random(), name: "", qty: 1, price: 0 }
      ]
    }));
  };

  const handleRemoveManualItem = (id) => {
    if (manualForm.items.length <= 1) {
      toast.error("Invoice must have at least one product item");
      return;
    }
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id)
    }));
  };

  const handleUpdateManualItem = (id, field, value) => {
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: field === "qty" || field === "price" ? Math.max(0, Number(value)) : value
          };
        }
        return item;
      })
    }));
  };

  const handleSelectCatalogProduct = (itemId, productId) => {
    const combinedList = products.length > 0 ? products : allProducts;
    const selectedProd = combinedList.find((p) => p._id === productId) || allProducts.find((p) => p._id === productId);
    if (!selectedProd) return;
    const price = selectedProd.salePrice || selectedProd.price || 0;
    setManualForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            productId: selectedProd._id,
            name: selectedProd.name,
            price: price,
          };
        }
        return item;
      })
    }));
  };

  // Calculations for manual form
  const getManualCalculations = () => {
    const subtotal = manualForm.items.reduce((acc, item) => {
      const q = Number(item.qty || 0);
      const p = Number(item.price || 0);
      return acc + q * p;
    }, 0);

    const deliveryFee = Number(manualForm.deliveryFee || 0);
    const gstRate = Number(manualForm.gstRate || 0);
    const gstAmount = (subtotal * gstRate) / 100;
    const discount = Number(manualForm.discount || 0);
    const grandTotal = Math.max(0, subtotal + deliveryFee + gstAmount - discount);

    return { subtotal, gstAmount, deliveryFee, discount, grandTotal };
  };

  // PDF Generator for Manual Invoice
  const downloadManualInvoice = () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const { subtotal, gstAmount, deliveryFee, discount, grandTotal } = getManualCalculations();

      // Header background
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("VEENOLEX RETAIL RECEIPT", 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`RECEIPT ID: ${manualForm.receiptId || "ORD-MANUAL"}`, 14, 25);

      const formattedDate = manualForm.orderDate
        ? new Date(manualForm.orderDate).toLocaleString("en-IN")
        : new Date().toLocaleString("en-IN");

      doc.text(`ORDER DATE: ${formattedDate}`, 140, 18);
      doc.text(`PAYMENT: ${manualForm.paymentMethod?.toUpperCase() || "CASH"}`, 140, 24);
      doc.text(`STATUS: ${manualForm.orderStatus?.toUpperCase() || "PAID"}`, 140, 30);

      // Issuer vs Customer details columns
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("SOLD BY", 14, 50);
      doc.text("CUSTOMER DETAILS", 110, 50);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);

      // Seller column
      let ySeller = 56;
      doc.text(`Store: ${manualForm.sellerShopName || "N/A"}`, 14, ySeller);
      ySeller += 5;
      if (manualForm.sellerOwnerName) {
        doc.text(`Owner: ${manualForm.sellerOwnerName}`, 14, ySeller);
        ySeller += 5;
      }
      doc.text(`Phone: ${manualForm.sellerPhone || "N/A"}`, 14, ySeller);
      ySeller += 5;
      doc.text(`Email: ${manualForm.sellerEmail || "N/A"}`, 14, ySeller);
      ySeller += 5;
      if (manualForm.sellerGst) {
        doc.text(`GSTIN: ${manualForm.sellerGst}`, 14, ySeller);
        ySeller += 5;
      }
      if (manualForm.sellerAddress) {
        const wrappedSellerAddr = doc.splitTextToSize(`Address: ${manualForm.sellerAddress}`, 85);
        doc.text(wrappedSellerAddr, 14, ySeller);
      }

      // Customer column
      let yCust = 56;
      doc.text(`Name: ${manualForm.customerName || "Walk-in Customer"}`, 110, yCust);
      yCust += 5;
      doc.text(`Phone: ${manualForm.customerPhone || "N/A"}`, 110, yCust);
      yCust += 5;
      if (manualForm.customerGst) {
        doc.text(`GSTIN: ${manualForm.customerGst}`, 110, yCust);
        yCust += 5;
      }
      const custAddressStr = manualForm.customerAddress || "Store Pick / Walk-in";
      const wrappedCustAddr = doc.splitTextToSize(`Address: ${custAddressStr}`, 85);
      doc.text(wrappedCustAddr, 110, yCust);

      // Items table
      const itemsRows = manualForm.items.map((item, idx) => {
        const name = item.name || "Product Item";
        const qty = Number(item.qty || 1);
        const rate = Number(item.price || 0);
        const amount = qty * rate;

        return [
          idx + 1,
          name,
          qty,
          `Rs. ${rate.toFixed(2)}`,
          `Rs. ${amount.toFixed(2)}`
        ];
      });

      // Render table
      autoTable(doc, {
        startY: 92,
        head: [["#", "ITEM DESCRIPTION", "QTY", "PRICE", "AMOUNT"]],
        body: itemsRows,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 100 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 30, halign: "right" }
        }
      });

      // Pricing Summary
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      doc.text(`Subtotal:`, 130, finalY);
      doc.text(`Rs. ${subtotal.toFixed(2)}`, 175, finalY, { align: "right" });

      doc.text(`Delivery Fee:`, 130, finalY + 5);
      doc.text(`Rs. ${deliveryFee.toFixed(2)}`, 175, finalY + 5, { align: "right" });

      doc.text(`Taxes / GST (${manualForm.gstRate}%):`, 130, finalY + 10);
      doc.text(`Rs. ${gstAmount.toFixed(2)}`, 175, finalY + 10, { align: "right" });

      let currentOffset = 15;
      if (discount > 0) {
        doc.text(`Discount:`, 130, finalY + currentOffset);
        doc.text(`- Rs. ${discount.toFixed(2)}`, 175, finalY + currentOffset, { align: "right" });
        currentOffset += 6;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Grand Total:`, 130, finalY + currentOffset);
      doc.text(`Rs. ${grandTotal.toFixed(2)}`, 175, finalY + currentOffset, { align: "right" });

      // Footer note
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Official Veenolex Retail Receipt - Generated by Admin Console.", 14, finalY + currentOffset + 20);

      // Save PDF
      doc.save(`Manual_Invoice_${manualForm.receiptId}.pdf`);
      toast.success("Manual Invoice PDF downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Manual Invoice PDF");
    }
  };

  // Generate and Download Stock Invoice PDF
  const downloadStockInvoice = () => {
    if (!selectedSeller) return;

    try {
      const doc = new jsPDF("p", "mm", "a4");

      // Invoice Header info
      doc.setFillColor(15, 23, 42); // slate-900 background
      doc.rect(0, 0, 210, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("VEENOLEX WHOLESALE", 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("INVENTORY STOCK VALUATION INVOICE", 14, 25);

      doc.setFontSize(9);
      const today = new Date().toLocaleString("en-IN");
      doc.text(`Generated on: ${today}`, 145, 18);
      doc.text("Portal: Admin Center", 145, 24);
      doc.text("System: Verified Live Stock", 145, 30);

      // Seller Details
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SELLER DETAILS", 14, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Store Name: ${selectedSeller.shopName || "N/A"}`, 14, 60);
      doc.text(`Owner: ${selectedSeller.ownerName || "N/A"}`, 14, 66);
      doc.text(`Contact: ${selectedSeller.phone || "N/A"} | ${selectedSeller.email || "N/A"}`, 14, 72);
      doc.text(`Address: ${selectedSeller.locationLabel || selectedSeller.address || "Location not set"}`, 14, 78);

      // Stock statistics
      let totalStockCount = 0;
      let totalStockValue = 0;

      const tableRows = [];
      let index = 1;

      products.forEach((p) => {
        const name = p.name;
        // If product has variants, list them
        if (p.variants && p.variants.length > 0) {
          p.variants.forEach((v) => {
            const vName = `${name} - ${v.name || v.size || ""}`;
            const sku = v.sku || p.sku || "-";
            const stock = Number(v.stock || 0);
            const rate = Number(v.salePrice || v.price || p.salePrice || p.price || 0);
            const total = stock * rate;

            totalStockCount += stock;
            totalStockValue += total;

            tableRows.push([
              index++,
              vName,
              sku,
              stock,
              `Rs. ${rate.toFixed(2)}`,
              `Rs. ${total.toFixed(2)}`
            ]);
          });
        } else {
          const sku = p.sku || "-";
          const stock = Number(p.stock || 0);
          const rate = Number(p.salePrice || p.price || 0);
          const total = stock * rate;

          totalStockCount += stock;
          totalStockValue += total;

          tableRows.push([
            index++,
            name,
            sku,
            stock,
            `Rs. ${rate.toFixed(2)}`,
            `Rs. ${total.toFixed(2)}`
          ]);
        }
      });

      // Stats boxes on PDF
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(130, 48, 66, 32, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("TOTAL STOCK ITEMS", 134, 54);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalStockCount} units`, 134, 60);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("CUMULATIVE VALUATION", 134, 68);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Rs. ${totalStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 134, 74);

      // Render table
      autoTable(doc, {
        startY: 86,
        head: [["#", "Product / Variant Name", "SKU / Code", "Stock Qty", "Rate", "Total Valuation"]],
        body: tableRows,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 70 },
          2: { cellWidth: 35 },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 25, halign: "right" },
          5: { cellWidth: 30, halign: "right" }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Stock Invoice Summary & Sign-off", 14, finalY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("This inventory statement details active stock items and variants currently registered in", 14, finalY + 5);
      doc.text("the Veenolex platform. Value calculations are computed against authorized seller sale prices.", 14, finalY + 9);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Grand Total Valuation: Rs. ${totalStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 120, finalY + 5);

      // Save PDF
      doc.save(`Stock_Invoice_${selectedSeller.shopName.replace(/\s+/g, "_")}.pdf`);
      toast.success("Stock invoice downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Stock Invoice PDF");
    }
  };

  // Generate and Download Order Receipt PDF
  const downloadOrderInvoice = () => {
    if (!selectedSeller || !selectedOrder) return;

    try {
      const doc = new jsPDF("p", "mm", "a4");

      // Header background
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("VEENOLEX RETAIL BILL", 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`ORDER ID: #${selectedOrder.orderId}`, 14, 25);

      doc.setFontSize(9);
      const orderDate = new Date(selectedOrder.createdAt).toLocaleString("en-IN");
      doc.text(`Order Date: ${orderDate}`, 140, 18);
      doc.text(`Payment: ${selectedOrder.payment?.method?.toUpperCase() || "N/A"}`, 140, 24);
      doc.text(`Status: ${selectedOrder.status?.toUpperCase() || "PENDING"}`, 140, 30);

      // Column spacing: two columns (Seller vs Customer info)
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("SELLER DETAILS", 14, 52);
      doc.text("SHIPPED TO / CUSTOMER", 110, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      // Seller col
      doc.text(`Store: ${selectedSeller.shopName || "N/A"}`, 14, 60);
      doc.text(`Owner: ${selectedSeller.ownerName || "N/A"}`, 14, 65);
      doc.text(`Phone: ${selectedSeller.phone || "N/A"}`, 14, 70);
      doc.text(`Email: ${selectedSeller.email || "N/A"}`, 14, 75);

      // Customer col
      doc.text(`Name: ${selectedOrder.customer?.name || "Walk-in Customer"}`, 110, 60);
      doc.text(`Phone: ${selectedOrder.customer?.phone || "N/A"}`, 110, 65);
      const deliveryAddress = selectedOrder.shippingAddress
        ? `${selectedOrder.shippingAddress.address || ""}, ${selectedOrder.shippingAddress.city || ""}, ${selectedOrder.shippingAddress.postalCode || ""}`
        : "Direct Warehouse Pick / Walk-in";

      const wrappedAddress = doc.splitTextToSize(deliveryAddress, 85);
      doc.text(wrappedAddress, 110, 70);

      // Items list
      const itemsRows = [];
      let idx = 1;
      const orderItems = selectedOrder.items || [];

      orderItems.forEach((item) => {
        const itemName = item.name || item.product?.name || "Product Item";
        const quantity = item.quantity || 1;
        const rate = item.price || item.product?.salePrice || item.product?.price || 0;
        const amount = rate * quantity;

        itemsRows.push([
          idx++,
          itemName,
          quantity,
          `Rs. ${rate.toFixed(2)}`,
          `Rs. ${amount.toFixed(2)}`
        ]);
      });

      // Render table
      autoTable(doc, {
        startY: 92,
        head: [["#", "Item Description", "Qty", "Unit Price", "Total Amount"]],
        body: itemsRows,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 100 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 30, halign: "right" }
        }
      });

      // Calculations summary
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const pricing = selectedOrder.pricing || {};
      const subtotal = pricing.subtotal || 0;
      const deliveryFee = pricing.deliveryFee || 0;
      const gst = pricing.gst || 0;
      const discount = pricing.discount || 0;
      const grandTotal = pricing.total || 0;

      doc.text(`Subtotal:`, 130, finalY);
      doc.text(`Rs. ${subtotal.toFixed(2)}`, 175, finalY, { align: "right" });

      doc.text(`Delivery Fee:`, 130, finalY + 5);
      doc.text(`Rs. ${deliveryFee.toFixed(2)}`, 175, finalY + 5, { align: "right" });

      doc.text(`GST / Taxes:`, 130, finalY + 10);
      doc.text(`Rs. ${gst.toFixed(2)}`, 175, finalY + 10, { align: "right" });

      if (discount > 0) {
        doc.text(`Discount:`, 130, finalY + 15);
        doc.text(`- Rs. ${discount.toFixed(2)}`, 175, finalY + 15, { align: "right" });
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const totalYOffset = discount > 0 ? 21 : 16;
      doc.text(`Grand Total:`, 130, finalY + totalYOffset);
      doc.text(`Rs. ${grandTotal.toFixed(2)}`, 175, finalY + totalYOffset, { align: "right" });

      // Footer notice
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Thank you for shopping with Veenolex. For complaints or billing requests,", 14, finalY + 35);
      doc.text("please connect directly via admin-support portal matching this Order ID reference.", 14, finalY + 39);

      // Save PDF
      doc.save(`Order_Receipt_${selectedOrder.orderId}.pdf`);
      toast.success("Order invoice downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Order Invoice PDF");
    }
  };

  // Generate and Download Refill Invoice PDF
  const downloadRefillInvoice = () => {
    if (!selectedSeller || !selectedRequest) return;

    try {
      const doc = new jsPDF("p", "mm", "a4");

      // Header background
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("VEENOLEX WHOLESALE", 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`STOCK REFILL BILL: #${selectedRequest.requestNumber || selectedRequest._id}`, 14, 25);

      doc.setFontSize(9);
      const requestDate = new Date(selectedRequest.createdAt).toLocaleString("en-IN");
      doc.text(`Request Date: ${requestDate}`, 140, 18);
      doc.text(`Payment: ${selectedRequest.paymentType?.toUpperCase() || "N/A"}`, 140, 24);
      doc.text(`Status: ${selectedRequest.status?.toUpperCase() || "PENDING"}`, 140, 30);

      // Columns
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("FROM (DISTRIBUTOR / WAREHOUSE)", 14, 52);
      doc.text("DELIVERED TO (SELLER)", 110, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      // Sender (Admin)
      doc.text("Veenolex Wholesale Warehouse", 14, 60);
      doc.text("Email: warehouse@veenolex.com", 14, 65);
      doc.text("Phone: +91 9999999999", 14, 70);
      doc.text("Address: Indore wholesale division, MP", 14, 75);

      // Seller details
      doc.text(`Store: ${selectedSeller.shopName || "N/A"}`, 110, 60);
      doc.text(`Owner: ${selectedSeller.ownerName || "N/A"}`, 110, 65);
      doc.text(`Phone: ${selectedSeller.phone || "N/A"}`, 110, 70);
      doc.text(`Email: ${selectedSeller.email || "N/A"}`, 110, 75);

      // Items list
      const itemsRows = [];
      let idx = 1;
      const requestItems = selectedRequest.items || [];

      requestItems.forEach((item) => {
        const itemName = item.productName || "Product Item";
        const quantity = item.quantity || 1;
        const rate = item.pricePerUnit || 0;
        const amount = item.totalPrice || (rate * quantity);

        itemsRows.push([
          idx++,
          itemName,
          quantity,
          `Rs. ${rate.toFixed(2)}`,
          `Rs. ${amount.toFixed(2)}`
        ]);
      });

      // Render table
      autoTable(doc, {
        startY: 92,
        head: [["#", "Product Description", "Qty Shipped", "Wholesale Rate", "Total Amount"]],
        body: itemsRows,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        styles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 100 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 30, halign: "right" }
        }
      });

      // Calculations summary
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const subtotal = selectedRequest.subtotal || 0;
      const tax = selectedRequest.tax || 0;
      const grandTotal = selectedRequest.totalAmount || 0;

      doc.text(`Subtotal:`, 130, finalY);
      doc.text(`Rs. ${subtotal.toFixed(2)}`, 175, finalY, { align: "right" });

      doc.text(`Tax / GST:`, 130, finalY + 5);
      doc.text(`Rs. ${tax.toFixed(2)}`, 175, finalY + 5, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Grand Total:`, 130, finalY + 11);
      doc.text(`Rs. ${grandTotal.toFixed(2)}`, 175, finalY + 11, { align: "right" });

      // Footer notice
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Stock Refill statements are internal transaction proofs between Veenolex Warehouse", 14, finalY + 25);
      doc.text("and the selected seller. Please verify physically before confirming receipt.", 14, finalY + 29);

      // Save PDF
      doc.save(`Stock_Delivery_${selectedRequest.requestNumber || selectedRequest._id}.pdf`);
      toast.success("Refill statement downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Refill statement PDF");
    }
  };

  // Stock summary stats helper
  const getStockSummaryStats = () => {
    let totalItems = 0;
    let totalValuation = 0;

    products.forEach((p) => {
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach((v) => {
          const qty = Number(v.stock || 0);
          const rate = Number(v.salePrice || v.price || p.salePrice || p.price || 0);
          totalItems += qty;
          totalValuation += qty * rate;
        });
      } else {
        const qty = Number(p.stock || 0);
        const rate = Number(p.salePrice || p.price || 0);
        totalItems += qty;
        totalValuation += qty * rate;
      }
    });

    return { totalItems, totalValuation };
  };

  const { totalItems, totalValuation } = getStockSummaryStats();

  return (
    <div className="ds-section-spacing pb-12">
      {/* Control Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            Seller Invoices
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Access and download stock inventory or transaction bills for active sellers.
          </p>
        </div>
      </div>

      {/* Select Seller Control */}
      <Card className="p-6 bg-white border border-slate-100 shadow-md">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
              <HiOutlineBuildingOffice2 className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Target Business
              </p>
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Select Active Seller
              </h4>
            </div>
          </div>

          <div className="flex-1 w-full">
            {loadingSellers ? (
              <div className="h-11 w-full bg-slate-50 animate-pulse rounded-xl border border-slate-100" />
            ) : (
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="w-full h-11 px-4 text-xs font-bold text-slate-700 bg-slate-50 ring-1 ring-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-950 transition-all uppercase tracking-wider"
              >
                <option value="">-- Choose Seller Store --</option>
                {sellers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.shopName} ({s.ownerName || "No Owner"})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {!selectedSellerId ? (
        <Card className="py-24 text-center border border-slate-100 shadow-md">
          <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center ring-1 ring-slate-100">
              <HiOutlineDocumentText className="h-8 w-8 text-slate-200" />
            </div>
            <p className="text-slate-900 font-black text-sm uppercase mt-2">
              No Seller Selected
            </p>
            <p className="text-xs font-medium text-slate-400">
              Select an active seller from the dropdown above to load and preview their inventory stock status or order lists.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">

          {/* Horizontal Store Profile Card */}
          <Card className="p-6 bg-slate-50 border border-slate-200/50 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Profile Details */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-white shadow-sm overflow-hidden flex items-center justify-center border border-slate-200 shrink-0">
                  {selectedSeller?.avatar ? (
                    <img src={selectedSeller.avatar} alt="logo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-slate-400 font-bold text-lg">{selectedSeller?.shopName?.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <HiOutlineBuildingOffice2 className="h-5 w-5 text-slate-500" />
                    <h3 className="text-sm font-black text-slate-900 uppercase leading-none">
                      {selectedSeller?.shopName}
                    </h3>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 ml-7">
                    {selectedSeller?.category || "General Store"}
                  </p>
                </div>
              </div>

              {/* Contact Information (Horizontal Grid) */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-xs font-semibold text-slate-700 border-t lg:border-t-0 lg:border-l lg:border-r border-slate-200/60 lg:px-6 pt-4 lg:pt-0">
                <div className="flex items-center gap-3">
                  <HiOutlineUser className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>Owner: {selectedSeller?.ownerName || "N/A"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <HiOutlineEnvelope className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="break-all">{selectedSeller?.email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <HiOutlinePhone className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{selectedSeller?.phone || "N/A"}</span>
                </div>
                <div className="flex items-start gap-3">
                  <HiOutlineMapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">{selectedSeller?.locationLabel || selectedSeller?.address || "Location not set"}</span>
                </div>
              </div>

              {/* Active Stats */}
              <div className="flex items-center gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-200/60 shrink-0">
                <div className="text-center bg-white border border-slate-100 rounded-2xl p-3 min-w-[90px] shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
                    Products
                  </p>
                  <p className="text-base font-black text-slate-900">{products.length}</p>
                </div>
                <div className="text-center bg-white border border-slate-100 rounded-2xl p-3 min-w-[90px] shadow-sm">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
                    Orders
                  </p>
                  <p className="text-base font-black text-slate-900">{orders.length}</p>
                </div>
              </div>
            </div>
          </Card>

            {/* Tabs Header */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl ring-1 ring-slate-200">
              <button
                onClick={() => setActiveTab("stock")}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === "stock"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                  }`}
              >
                Stock Invoice
              </button>
              <button
                onClick={() => setActiveTab("order")}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === "order"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                  }`}
              >
                Particular Order Invoice
              </button>
              <button
                onClick={() => setActiveTab("refill")}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === "refill"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                  }`}
              >
                Stock Delivered to Seller
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeTab === "manual"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                  }`}
              >
                Create Manual Invoice
              </button>
            </div>

            {/* Tab content: Stock Invoice */}
            {activeTab === "stock" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Actions and totals */}
                <Card className="p-5 bg-white border border-slate-100 shadow-md">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Current Inventory Valuation
                      </p>
                      <h3 className="text-xl font-black text-slate-950 mt-0.5">
                        {currency(totalValuation)}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Accumulated over {totalItems} total stock units
                      </span>
                    </div>

                    <button
                      onClick={downloadStockInvoice}
                      disabled={loadingProducts || products.length === 0}
                      className="px-5 py-3 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <HiOutlineArrowDownTray className="h-4 w-4" />
                      Download Stock Invoice
                    </button>
                  </div>
                </Card>

                {/* Stock table */}
                <Card className="overflow-hidden border border-slate-100 shadow-md">
                  {loadingProducts ? (
                    <div className="p-16 text-center">
                      <div className="h-10 w-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Fetching Store Stock...
                      </p>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="p-16 text-center">
                      <HiOutlineDocumentText className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-900 font-bold text-sm uppercase">
                        No Products Registered
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        This seller doesn't have any catalog items to evaluate.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                            <th className="px-5 py-4 w-12">#</th>
                            <th className="px-5 py-4">Item Name / Variant</th>
                            <th className="px-5 py-4">SKU / Code</th>
                            <th className="px-5 py-4 text-center">Stock</th>
                            <th className="px-5 py-4 text-right">Sale Rate</th>
                            <th className="px-5 py-4 text-right">Total Valuation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-semibold">
                          {(() => {
                            let idx = 1;
                            return products.map((p) => {
                              if (p.variants && p.variants.length > 0) {
                                return p.variants.map((v, vIdx) => {
                                  const name = `${p.name} - ${v.name || v.size || ""}`;
                                  const sku = v.sku || p.sku || "-";
                                  const qty = Number(v.stock || 0);
                                  const rate = Number(v.salePrice || v.price || p.salePrice || p.price || 0);
                                  const total = qty * rate;

                                  return (
                                    <tr key={`${p._id}-${vIdx}`} className="hover:bg-slate-50/50">
                                      <td className="px-5 py-4 font-bold text-slate-400">{idx++}</td>
                                      <td className="px-5 py-4 text-slate-950 font-black uppercase">{name}</td>
                                      <td className="px-5 py-4 text-slate-400 tracking-wider font-bold">{sku}</td>
                                      <td className="px-5 py-4 text-center font-black">{qty}</td>
                                      <td className="px-5 py-4 text-right">{currency(rate)}</td>
                                      <td className="px-5 py-4 text-right text-slate-950 font-black">{currency(total)}</td>
                                    </tr>
                                  );
                                });
                              } else {
                                const sku = p.sku || "-";
                                const qty = Number(p.stock || 0);
                                const rate = Number(p.salePrice || p.price || 0);
                                const total = qty * rate;

                                return (
                                  <tr key={p._id} className="hover:bg-slate-50/50">
                                    <td className="px-5 py-4 font-bold text-slate-400">{idx++}</td>
                                    <td className="px-5 py-4 text-slate-950 font-black uppercase">{p.name}</td>
                                    <td className="px-5 py-4 text-slate-400 tracking-wider font-bold">{sku}</td>
                                    <td className="px-5 py-4 text-center font-black">{qty}</td>
                                    <td className="px-5 py-4 text-right">{currency(rate)}</td>
                                    <td className="px-5 py-4 text-right text-slate-950 font-black">{currency(total)}</td>
                                  </tr>
                                );
                              }
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Tab content: Particular Order Invoice */}
            {activeTab === "order" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Actions and Selector */}
                <Card className="p-5 bg-white border border-slate-100 shadow-md">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Choose Particular Order
                      </p>
                      <h3 className="text-sm font-black text-slate-900 uppercase mt-0.5">
                        Receipt Dispatch Selection
                      </h3>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                        {loadingOrders ? (
                          <div className="h-11 w-full bg-slate-50 animate-pulse rounded-xl border border-slate-100" />
                        ) : orders.length === 0 ? (
                          <select disabled className="w-full h-11 px-4 text-xs font-bold text-slate-400 bg-slate-50 ring-1 ring-slate-200 rounded-xl outline-none">
                            <option>No orders found for this seller</option>
                          </select>
                        ) : (
                          <select
                            value={selectedOrderId}
                            onChange={(e) => handleOrderChange(e.target.value)}
                            className="w-full h-11 px-4 text-xs font-bold text-slate-700 bg-slate-50 ring-1 ring-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-950 transition-all uppercase tracking-wider"
                          >
                            {orders.map((o) => (
                              <option key={o._id} value={o.orderId}>
                                Order #{o.orderId} - Rs. {(o.pricing?.total || 0).toFixed(0)} ({new Date(o.createdAt).toLocaleDateString()})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <button
                        onClick={downloadOrderInvoice}
                        disabled={loadingOrders || !selectedOrder}
                        className="w-full md:w-auto px-5 py-3 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <HiOutlineArrowDownTray className="h-4 w-4" />
                        Download Order Receipt
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Receipt Live Preview Card */}
                {selectedOrder && (
                  <Card className="border border-slate-200 shadow-xl overflow-hidden bg-white max-w-2xl mx-auto">
                    {/* Visual Receipt Header */}
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tight">
                          Veenolex Retail Receipt
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Receipt ID: {selectedOrder.orderId}
                        </span>
                      </div>
                      <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest space-y-1">
                        <p className="text-white font-black">ORDER DATE</p>
                        <p>{new Date(selectedOrder.createdAt).toLocaleDateString("en-IN")}</p>
                        <p>{new Date(selectedOrder.createdAt).toLocaleTimeString("en-IN")}</p>
                      </div>
                    </div>

                    {/* Receipt Body */}
                    <div className="p-6 space-y-6">

                      {/* Customer / Seller details */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            Sold By
                          </p>
                          <p className="font-black text-slate-950 uppercase">{selectedSeller?.shopName}</p>
                          <p className="text-slate-500 font-semibold mt-1">Phone: {selectedSeller?.phone}</p>
                          <p className="text-slate-500 font-semibold">{selectedSeller?.email}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            Customer Details
                          </p>
                          <p className="font-black text-slate-950 uppercase">{selectedOrder.customer?.name || "Walk-in Customer"}</p>
                          <p className="text-slate-500 font-semibold mt-1">Phone: {selectedOrder.customer?.phone || "N/A"}</p>
                          <p className="text-slate-500 font-semibold truncate">
                            {selectedOrder.shippingAddress
                              ? `${selectedOrder.shippingAddress.address || ""}, ${selectedOrder.shippingAddress.city || ""}`
                              : "Store Pick / Walk-in"}
                          </p>
                        </div>
                      </div>

                      {/* Items list */}
                      <div className="border-t border-b border-slate-100 py-3">
                        <div className="grid grid-cols-12 text-[9px] font-black text-slate-400 uppercase tracking-widest pb-2 mb-2 border-b border-slate-50">
                          <span className="col-span-6">Item description</span>
                          <span className="col-span-2 text-center">Qty</span>
                          <span className="col-span-2 text-right">Price</span>
                          <span className="col-span-2 text-right">Amount</span>
                        </div>

                        <div className="space-y-2.5">
                          {(selectedOrder.items || []).map((item, idx) => {
                            const name = item.name || item.product?.name || "Product Item";
                            const qty = item.quantity || 1;
                            const rate = item.price || item.product?.salePrice || item.product?.price || 0;
                            const amount = rate * qty;

                            return (
                              <div key={idx} className="grid grid-cols-12 text-xs font-semibold text-slate-700 items-center">
                                <span className="col-span-6 font-black text-slate-900 uppercase">{name}</span>
                                <span className="col-span-2 text-center">{qty}</span>
                                <span className="col-span-2 text-right">{currency(rate)}</span>
                                <span className="col-span-2 text-right font-black text-slate-950">{currency(amount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Receipt calculations */}
                      <div className="flex flex-col items-end gap-2 text-xs font-semibold text-slate-500">
                        <div className="w-64 flex justify-between">
                          <span>Subtotal:</span>
                          <span className="text-slate-950 font-bold">{currency(selectedOrder.pricing?.subtotal)}</span>
                        </div>
                        <div className="w-64 flex justify-between">
                          <span>Delivery Fee:</span>
                          <span className="text-slate-950 font-bold">{currency(selectedOrder.pricing?.deliveryFee)}</span>
                        </div>
                        <div className="w-64 flex justify-between">
                          <span>Taxes / GST:</span>
                          <span className="text-slate-950 font-bold">{currency(selectedOrder.pricing?.gst)}</span>
                        </div>

                        {Number(selectedOrder.pricing?.discount || 0) > 0 && (
                          <div className="w-64 flex justify-between text-brand-600 font-bold">
                            <span>Discount Applied:</span>
                            <span>- {currency(selectedOrder.pricing?.discount)}</span>
                          </div>
                        )}

                        <div className="w-64 flex justify-between border-t border-slate-100 pt-3 text-slate-950 font-black text-sm">
                          <span>Grand Total:</span>
                          <span>{currency(selectedOrder.pricing?.total)}</span>
                        </div>
                      </div>

                      {/* Transaction info */}
                      <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-2">
                          <HiOutlineCreditCard className="h-4 w-4 text-slate-400" />
                          Payment: <span className="text-slate-900 uppercase">{selectedOrder.payment?.method || "UPI"}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <HiOutlineCalendar className="h-4 w-4 text-slate-400" />
                          Status: <Badge variant="success" className="text-[8px] font-black tracking-widest uppercase">{selectedOrder.status || "delivered"}</Badge>
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Tab content: Stock Delivered to Seller */}
            {activeTab === "refill" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Actions and Selector */}
                <Card className="p-5 bg-white border border-slate-100 shadow-md">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Choose Refill Request
                      </p>
                      <h3 className="text-sm font-black text-slate-900 uppercase mt-0.5">
                        Delivered stock to seller
                      </h3>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                        {loadingRefills ? (
                          <div className="h-11 w-full bg-slate-50 animate-pulse rounded-xl border border-slate-100" />
                        ) : refillRequests.length === 0 ? (
                          <select disabled className="w-full h-11 px-4 text-xs font-bold text-slate-400 bg-slate-50 ring-1 ring-slate-200 rounded-xl outline-none">
                            <option>No delivered refill requests found for this seller</option>
                          </select>
                        ) : (
                          <select
                            value={selectedRequestId}
                            onChange={(e) => handleRefillChange(e.target.value)}
                            className="w-full h-11 px-4 text-xs font-bold text-slate-700 bg-slate-50 ring-1 ring-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-950 transition-all uppercase tracking-wider"
                          >
                            {refillRequests.map((r) => (
                              <option key={r._id} value={r.requestNumber || r._id}>
                                Request #{r.requestNumber || r._id.substring(0,8)} - Rs. {(r.totalAmount || 0).toFixed(0)} ({r.status})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      
                      <button
                        onClick={downloadRefillInvoice}
                        disabled={loadingRefills || !selectedRequest}
                        className="w-full md:w-auto px-5 py-3 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <HiOutlineArrowDownTray className="h-4 w-4" />
                        Download Refill Bill
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Refill Live Preview Card */}
                {selectedRequest && (
                  <Card className="border border-slate-200 shadow-xl overflow-hidden bg-white max-w-2xl mx-auto">
                    {/* Visual Refill Header */}
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tight">
                          Stock Refill Bill
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          REQ ID: {selectedRequest.requestNumber || selectedRequest._id}
                        </span>
                      </div>
                      <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest space-y-1">
                        <p className="text-white font-black">REQUEST DATE</p>
                        <p>{new Date(selectedRequest.createdAt).toLocaleDateString("en-IN")}</p>
                        <p>Status: {selectedRequest.status}</p>
                      </div>
                    </div>

                    {/* Receipt Body */}
                    <div className="p-6 space-y-6">
                      
                      {/* Customer / Seller details */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            Dispatched From
                          </p>
                          <p className="font-black text-slate-950 uppercase">Veenolex Wholesale Warehouse</p>
                          <p className="text-slate-500 font-semibold mt-1">Email: warehouse@veenolex.com</p>
                          <p className="text-slate-500 font-semibold">Phone: +91 9999999999</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                            Delivered To Seller
                          </p>
                          <p className="font-black text-slate-950 uppercase">{selectedSeller?.shopName}</p>
                          <p className="text-slate-500 font-semibold mt-1">Owner: {selectedSeller?.ownerName || "N/A"}</p>
                          <p className="text-slate-500 font-semibold">Phone: {selectedSeller?.phone}</p>
                        </div>
                      </div>

                      {/* Items list */}
                      <div className="border-t border-b border-slate-100 py-3">
                        <div className="grid grid-cols-12 text-[9px] font-black text-slate-400 uppercase tracking-widest pb-2 mb-2 border-b border-slate-50">
                          <span className="col-span-6">Product name</span>
                          <span className="col-span-2 text-center">Qty Shipped</span>
                          <span className="col-span-2 text-right">Wholesale Price</span>
                          <span className="col-span-2 text-right">Amount</span>
                        </div>

                        <div className="space-y-2.5">
                          {(selectedRequest.items || []).map((item, idx) => {
                            const name = item.productName || "Product Item";
                            const qty = item.quantity || 1;
                            const rate = item.pricePerUnit || 0;
                            const amount = item.totalPrice || (rate * qty);

                            return (
                              <div key={idx} className="grid grid-cols-12 text-xs font-semibold text-slate-700 items-center">
                                <span className="col-span-6 font-black text-slate-900 uppercase">{name}</span>
                                <span className="col-span-2 text-center">{qty}</span>
                                <span className="col-span-2 text-right">{currency(rate)}</span>
                                <span className="col-span-2 text-right font-black text-slate-950">{currency(amount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Receipt calculations */}
                      <div className="flex flex-col items-end gap-2 text-xs font-semibold text-slate-500">
                        <div className="w-64 flex justify-between">
                          <span>Subtotal:</span>
                          <span className="text-slate-950 font-bold">{currency(selectedRequest.subtotal)}</span>
                        </div>
                        <div className="w-64 flex justify-between">
                          <span>Taxes / GST:</span>
                          <span className="text-slate-950 font-bold">{currency(selectedRequest.tax)}</span>
                        </div>
                        <div className="w-64 flex justify-between border-t border-slate-100 pt-3 text-slate-950 font-black text-sm">
                          <span>Grand Total:</span>
                          <span>{currency(selectedRequest.totalAmount)}</span>
                        </div>
                      </div>

                      {/* Transaction info */}
                      <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-bold text-slate-500">
                        <span className="flex items-center gap-2">
                          <HiOutlineCreditCard className="h-4 w-4 text-slate-400" />
                          Payment Status: <span className="text-slate-900 uppercase font-black">{selectedRequest.paymentStatus || "PENDING"}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <HiOutlineCalendar className="h-4 w-4 text-slate-400" />
                          Status: <Badge variant={selectedRequest.status === "DELIVERED" ? "success" : "primary"} className="text-[8px] font-black tracking-widest uppercase">{selectedRequest.status || "PENDING"}</Badge>
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Tab content: Create Manual Invoice */}
            {activeTab === "manual" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Editable Invoice Builder Form (7 Cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Header bar for builder */}
                    <Card className="p-5 bg-white border border-slate-100 shadow-md flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <HiOutlinePencilSquare className="h-5 w-5 text-brand-600" />
                          <h3 className="text-sm font-black text-slate-900 uppercase">
                            Manual Invoice Builder
                          </h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          Edit seller, customer, products, and prices manually
                        </p>
                      </div>

                      <button
                        onClick={handleResetManualForm}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        title="Reset form fields"
                      >
                        <HiOutlineArrowPath className="h-3.5 w-3.5" />
                        Reset
                      </button>
                    </Card>

                    {/* Form Section 1: Invoice & Transaction Details */}
                    <Card className="p-5 bg-white border border-slate-100 shadow-md space-y-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                        1. Invoice & Order Metadata
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Receipt / Invoice ID
                          </label>
                          <input
                            type="text"
                            value={manualForm.receiptId}
                            onChange={(e) => setManualForm(prev => ({ ...prev, receiptId: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="ORD-XXXXXX"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Order Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            value={manualForm.orderDate}
                            onChange={(e) => setManualForm(prev => ({ ...prev, orderDate: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Payment Method
                          </label>
                          <select
                            value={manualForm.paymentMethod}
                            onChange={(e) => setManualForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase outline-none focus:ring-2 focus:ring-slate-950"
                          >
                            <option value="CASH">CASH</option>
                            <option value="UPI">UPI / QR</option>
                            <option value="CARD">CARD / POS</option>
                            <option value="NET_BANKING">NET BANKING</option>
                            <option value="PAY_LATER">PAY LATER / CREDIT</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Order Status
                          </label>
                          <select
                            value={manualForm.orderStatus}
                            onChange={(e) => setManualForm(prev => ({ ...prev, orderStatus: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase outline-none focus:ring-2 focus:ring-slate-950"
                          >
                            <option value="PAID">PAID</option>
                            <option value="PENDING">PENDING</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                      </div>
                    </Card>

                    {/* Form Section 2: Seller Details */}
                    <Card className="p-5 bg-white border border-slate-100 shadow-md space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          2. Seller / Issuer Details
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          (Editable)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Store / Shop Name
                          </label>
                          <input
                            type="text"
                            value={manualForm.sellerShopName}
                            onChange={(e) => setManualForm(prev => ({ ...prev, sellerShopName: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Store Name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Owner Name
                          </label>
                          <input
                            type="text"
                            value={manualForm.sellerOwnerName}
                            onChange={(e) => setManualForm(prev => ({ ...prev, sellerOwnerName: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Owner Name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={manualForm.sellerPhone}
                            onChange={(e) => setManualForm(prev => ({ ...prev, sellerPhone: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Phone Number"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={manualForm.sellerEmail}
                            onChange={(e) => setManualForm(prev => ({ ...prev, sellerEmail: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="seller@example.com"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Seller GST Number (GSTIN)
                          </label>
                          <input
                            type="text"
                            value={manualForm.sellerGst}
                            onChange={(e) => setManualForm(prev => ({ ...prev, sellerGst: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="27AAAAA0000A1Z5"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Store Address
                          </label>
                          <input
                            type="text"
                            value={manualForm.sellerAddress}
                            onChange={(e) => setManualForm(prev => ({ ...prev, sellerAddress: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Full address"
                          />
                        </div>
                      </div>
                    </Card>

                    {/* Form Section 3: Customer Details */}
                    <Card className="p-5 bg-white border border-slate-100 shadow-md space-y-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                        3. Customer Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Customer Name
                          </label>
                          <input
                            type="text"
                            value={manualForm.customerName}
                            onChange={(e) => setManualForm(prev => ({ ...prev, customerName: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="e.g. Mukesh Kumar"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Mobile / Phone Number
                          </label>
                          <input
                            type="text"
                            value={manualForm.customerPhone}
                            onChange={(e) => setManualForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="+9191314122721"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Customer GST Number (GSTIN)
                          </label>
                          <input
                            type="text"
                            value={manualForm.customerGst}
                            onChange={(e) => setManualForm(prev => ({ ...prev, customerGst: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Optional Customer GSTIN"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Customer Address / Shipping Info
                          </label>
                          <input
                            type="text"
                            value={manualForm.customerAddress}
                            onChange={(e) => setManualForm(prev => ({ ...prev, customerAddress: e.target.value }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Store Pick / Walk-in / Delivery Address"
                          />
                        </div>
                      </div>
                    </Card>

                    {/* Form Section 4: Product Items */}
                    <Card className="p-5 bg-white border border-slate-100 shadow-md space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          4. Product Items & Prices
                        </h4>
                        <button
                          onClick={handleAddManualItem}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                        >
                          <HiOutlinePlus className="h-3.5 w-3.5" />
                          Add Product Item
                        </button>
                      </div>

                      <div className="space-y-3">
                        {manualForm.items.map((item, idx) => {
                          const itemTotal = Number(item.qty || 0) * Number(item.price || 0);
                          const catalogList = products.length > 0 ? products : allProducts;

                          return (
                            <div
                              key={item.id}
                              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                            >
                              <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase">
                                <span>Item #{idx + 1}</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start text-xs font-bold text-slate-700">
                                {/* Product Selection & Name Input */}
                                <div className="md:col-span-5 space-y-1.5">
                                  <label className="block text-[9px] font-black uppercase text-slate-400">
                                    Select Product
                                  </label>

                                  <select
                                    value={item.productId || ""}
                                    onChange={(e) => handleSelectCatalogProduct(item.id, e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-slate-950 uppercase cursor-pointer"
                                  >
                                    <option value="">-- Choose Product Dropdown --</option>
                                    {catalogList.map((p) => (
                                      <option key={p._id} value={p._id}>
                                        {p.name} (Rs. {p.salePrice || p.price || 0})
                                      </option>
                                    ))}
                                  </select>

                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => handleUpdateManualItem(item.id, "name", e.target.value)}
                                    className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-2 focus:ring-slate-950 uppercase"
                                    placeholder="Or edit product name manually..."
                                  />
                                </div>

                                {/* Qty */}
                                <div className="md:col-span-2">
                                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">
                                    Qty
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.qty}
                                    onChange={(e) => handleUpdateManualItem(item.id, "qty", e.target.value)}
                                    className="w-full h-9 px-2 text-center bg-white border border-slate-200 rounded-lg font-bold outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                </div>

                                {/* Price / Rate */}
                                <div className="md:col-span-2">
                                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">
                                    Price (Rs.)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price}
                                    onChange={(e) => handleUpdateManualItem(item.id, "price", e.target.value)}
                                    className="w-full h-9 px-2 text-right bg-white border border-slate-200 rounded-lg font-bold outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                </div>

                                {/* Total Amount */}
                                <div className="md:col-span-2 text-right">
                                  <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                                    Amount
                                  </label>
                                  <div className="h-9 flex items-center justify-end font-black text-slate-950">
                                    Rs. {itemTotal.toFixed(2)}
                                  </div>
                                </div>

                                {/* Remove Button */}
                                <div className="md:col-span-1 flex justify-end">
                                  <button
                                    onClick={() => handleRemoveManualItem(item.id)}
                                    className="h-9 w-9 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center transition-all mt-3 md:mt-0"
                                    title="Delete row"
                                  >
                                    <HiOutlineTrash className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Form Section 5: Charges, Tax & Discounts */}
                    <Card className="p-5 bg-white border border-slate-100 shadow-md space-y-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                        5. Additional Charges & Taxes
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-bold text-slate-700">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Delivery / Shipping Fee (Rs.)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={manualForm.deliveryFee}
                            onChange={(e) => setManualForm(prev => ({ ...prev, deliveryFee: Number(e.target.value) }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            GST / Tax Rate (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={manualForm.gstRate}
                            onChange={(e) => setManualForm(prev => ({ ...prev, gstRate: Number(e.target.value) }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="e.g. 18 or 0"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Discount Amount (Rs.)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={manualForm.discount}
                            onChange={(e) => setManualForm(prev => ({ ...prev, discount: Number(e.target.value) }))}
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Right Column: Live Receipt Preview & Download Action (5 Cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    <Card className="p-5 bg-white border border-slate-100 shadow-md flex items-center justify-between sticky top-6">
                      <div className="w-full space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Live Receipt Preview
                            </p>
                            <h3 className="text-sm font-black text-slate-950 uppercase mt-0.5">
                              Ready for Download
                            </h3>
                          </div>
                          <button
                            onClick={downloadManualInvoice}
                            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                          >
                            <HiOutlineArrowDownTray className="h-4 w-4" />
                            Download Invoice PDF
                          </button>
                        </div>

                        {/* Live Receipt Preview Card (Matching Retail Receipt Visual) */}
                        {(() => {
                          const { subtotal, gstAmount, deliveryFee, discount, grandTotal } = getManualCalculations();

                          return (
                            <div className="border border-slate-200 shadow-xl overflow-hidden bg-white rounded-2xl">
                              {/* Visual Receipt Header */}
                              <div className="p-5 bg-slate-900 text-white flex justify-between items-start">
                                <div>
                                  <h4 className="text-base font-black uppercase tracking-tight">
                                    Veenolex Retail Receipt
                                  </h4>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                                    RECEIPT ID: {manualForm.receiptId || "ORD-MANUAL"}
                                  </span>
                                </div>
                                <div className="text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest space-y-0.5">
                                  <p className="text-white font-black">ORDER DATE</p>
                                  <p>{manualForm.orderDate ? new Date(manualForm.orderDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}</p>
                                  <p>{manualForm.orderDate ? new Date(manualForm.orderDate).toLocaleTimeString("en-IN") : new Date().toLocaleTimeString("en-IN")}</p>
                                </div>
                              </div>

                              {/* Receipt Body */}
                              <div className="p-5 space-y-5">
                                {/* Sold By & Customer Details Grid */}
                                <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-100 pb-3">
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                      Sold By
                                    </p>
                                    <p className="font-black text-slate-950 uppercase">{manualForm.sellerShopName || "HARSH'S HUB"}</p>
                                    <p className="text-slate-500 font-semibold mt-0.5">Phone: {manualForm.sellerPhone || "N/A"}</p>
                                    <p className="text-slate-500 font-semibold truncate">{manualForm.sellerEmail || "N/A"}</p>
                                    {manualForm.sellerGst && (
                                      <p className="text-slate-500 font-semibold text-[10px]">GST: {manualForm.sellerGst}</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                      Customer Details
                                    </p>
                                    <p className="font-black text-slate-950 uppercase">{manualForm.customerName || "Walk-in Customer"}</p>
                                    <p className="text-slate-500 font-semibold mt-0.5">Phone: {manualForm.customerPhone || "N/A"}</p>
                                    <p className="text-slate-500 font-semibold truncate">
                                      {manualForm.customerAddress || "Store Pick / Walk-in"}
                                    </p>
                                    {manualForm.customerGst && (
                                      <p className="text-slate-500 font-semibold text-[10px]">GST: {manualForm.customerGst}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Items list table */}
                                <div className="space-y-2 border-b border-slate-100 pb-3">
                                  <div className="grid grid-cols-12 text-[9px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-50">
                                    <span className="col-span-6">Item description</span>
                                    <span className="col-span-2 text-center">Qty</span>
                                    <span className="col-span-2 text-right">Price</span>
                                    <span className="col-span-2 text-right">Amount</span>
                                  </div>

                                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {manualForm.items.map((item, idx) => {
                                      const name = item.name || "Product Item";
                                      const qty = Number(item.qty || 1);
                                      const rate = Number(item.price || 0);
                                      const amount = qty * rate;

                                      return (
                                        <div key={idx} className="grid grid-cols-12 text-xs font-semibold text-slate-700 items-center">
                                          <span className="col-span-6 font-black text-slate-900 uppercase truncate">{name}</span>
                                          <span className="col-span-2 text-center">{qty}</span>
                                          <span className="col-span-2 text-right">{currency(rate)}</span>
                                          <span className="col-span-2 text-right font-black text-slate-950">{currency(amount)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Receipt calculations */}
                                <div className="flex flex-col items-end gap-1.5 text-xs font-semibold text-slate-500">
                                  <div className="w-full flex justify-between">
                                    <span>Subtotal:</span>
                                    <span className="text-slate-950 font-bold">{currency(subtotal)}</span>
                                  </div>
                                  <div className="w-full flex justify-between">
                                    <span>Delivery Fee:</span>
                                    <span className="text-slate-950 font-bold">{currency(deliveryFee)}</span>
                                  </div>
                                  <div className="w-full flex justify-between">
                                    <span>Taxes / GST ({manualForm.gstRate}%):</span>
                                    <span className="text-slate-950 font-bold">{currency(gstAmount)}</span>
                                  </div>

                                  {discount > 0 && (
                                    <div className="w-full flex justify-between text-brand-600 font-bold">
                                      <span>Discount:</span>
                                      <span>- {currency(discount)}</span>
                                    </div>
                                  )}

                                  <div className="w-full flex justify-between border-t border-slate-100 pt-2 text-slate-950 font-black text-sm">
                                    <span>Grand Total:</span>
                                    <span>{currency(grandTotal)}</span>
                                  </div>
                                </div>

                                {/* Transaction info badges */}
                                <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-bold text-slate-500">
                                  <span className="flex items-center gap-1.5">
                                    <HiOutlineCreditCard className="h-4 w-4 text-slate-400" />
                                    Payment: <span className="text-slate-900 uppercase font-black">{manualForm.paymentMethod}</span>
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <HiOutlineCalendar className="h-4 w-4 text-slate-400" />
                                    Status: <Badge variant="success" className="text-[8px] font-black tracking-widest uppercase">{manualForm.orderStatus}</Badge>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}
        </div>
      )}
    </div>
  );
}
