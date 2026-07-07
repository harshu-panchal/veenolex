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
      setProducts(res.data?.data?.results || res.data?.results || res.data?.products || []);
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
      const orderList = res.data?.data?.items || res.data?.results?.items || res.data?.items || [];
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
      const totalActiveProducts = products.length;
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Side: Seller Info Details */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 bg-slate-50 border border-slate-200/50 shadow-md">
              <h3 className="text-lg font-black text-slate-900 uppercase border-b border-slate-200/60 pb-3 mb-4 flex items-center gap-2">
                <HiOutlineBuildingOffice2 className="h-5 w-5 text-slate-500" />
                Store Profile
              </h3>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center border border-slate-200">
                    {selectedSeller?.avatar ? (
                      <img src={selectedSeller.avatar} alt="logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-slate-400 font-bold text-lg">{selectedSeller?.shopName?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 uppercase text-sm leading-tight">
                      {selectedSeller?.shopName}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {selectedSeller?.category || "General Store"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-200/60 text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-3">
                    <HiOutlineUser className="h-4 w-4 text-slate-400" />
                    <span>Owner: {selectedSeller?.ownerName || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <HiOutlineEnvelope className="h-4 w-4 text-slate-400" />
                    <span className="break-all">{selectedSeller?.email || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <HiOutlinePhone className="h-4 w-4 text-slate-400" />
                    <span>{selectedSeller?.phone || "N/A"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <HiOutlineMapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <span className="leading-relaxed">{selectedSeller?.locationLabel || selectedSeller?.address || "Location not set"}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white border border-slate-100 shadow-md">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                Active Stats
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Products
                  </p>
                  <p className="text-lg font-black text-slate-900">{products.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Orders
                  </p>
                  <p className="text-lg font-black text-slate-900">{orders.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Side: Tab Panel */}
          <div className="lg:col-span-8 space-y-6">

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
          </div>
        </div>
      )}
    </div>
  );
}
