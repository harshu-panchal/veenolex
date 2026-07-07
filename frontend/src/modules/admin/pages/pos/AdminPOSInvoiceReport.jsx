import { useState, useEffect } from "react";
import { Search, Calendar, Trash2, Printer, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";
import { getAdminPOSBillSettings } from "../../../../utils/adminPosBillSettings";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminPOSInvoiceReport() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Print support
  const [printOrder, setPrintOrder] = useState(null);
  const billSettings = getAdminPOSBillSettings();

  useEffect(() => {
    fetchInvoices();
  }, [startDate, endDate, paymentMethod, page]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getInvoiceReport({
        startDate,
        endDate,
        paymentMethod: paymentMethod || undefined,
        page,
        limit: 20
      });
      if (res.data?.success) {
        setOrders(res.data.orders || []);
        setTotalPages(res.data.pagination?.pages || 1);
      }
    } catch {
      toast.error("Failed to load POS invoice report");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, phone) => {
    if (phone !== "0000000000") {
      toast.error("Only Walk-in customer POS invoices can be deleted");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this POS invoice? This is permanent.")) return;

    try {
      setLoading(true);
      const res = await adminPosApi.deleteOrder(id);
      if (res.data?.success) {
        toast.success("POS invoice deleted successfully");
        fetchInvoices();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete invoice");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDownloadPDF = (order) => {
    const doc = new jsPDF({ format: "a4", unit: "mm" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(billSettings.shopName.text, 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Address: ${billSettings.address.text}`, 14, 26);
    doc.text(`Phone: ${billSettings.phone.text}`, 14, 31);

    doc.text(`Invoice ID: ${order.orderId}`, 140, 20);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 140, 25);
    doc.text(`Customer Name: ${order.customerName || "N/A"}`, 140, 30);
    doc.text(`Customer Phone: ${order.customerPhone || "N/A"}`, 140, 35);

    doc.line(14, 42, 196, 42);

    const tableRows = order.items.map((item, idx) => [
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
    doc.text(`Subtotal: Rs. ${(order.pricing?.subtotal || 0).toFixed(2)}`, 140, finalY);
    doc.text(`Total Tax: Rs. ${(order.pricing?.gst || 0).toFixed(2)}`, 140, finalY + 5);
    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total: Rs. ${(order.pricing?.total || 0).toFixed(2)}`, 140, finalY + 11);

    doc.save(`Invoice_${order.orderId}.pdf`);
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">POS Invoices Registry</h2>
        <p className="text-xs text-slate-400 font-medium">Reprint receipts, download PDFs, or delete cashier sales</p>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {/* Start Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-400 font-bold uppercase">Start Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 pl-9 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
        </div>

        {/* End Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-400 font-bold uppercase">End Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 pl-9 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-slate-400 font-bold uppercase">Payment Mode</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 transition-colors"
          >
            <option value="">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="Credit">Credit (Udhaar)</option>
            <option value="Online">Online (PhonePe)</option>
          </select>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No POS invoices found
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    <th className="p-4 font-semibold">Invoice ID</th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Customer</th>
                    <th className="p-4 font-semibold">Payment Method</th>
                    <th className="p-4 text-right font-semibold">Items</th>
                    <th className="p-4 text-right font-bold">Total Amount</th>
                    <th className="p-4 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono font-semibold text-emerald-600">{o.orderId}</td>
                      <td className="p-4 text-slate-400">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="p-4 font-bold text-slate-800">{o.customerName || "Walk-in"}</td>
                      <td className="p-4">
                        <span className="inline-block bg-slate-50 text-slate-650 border border-slate-200/60 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {o.posPaymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="p-4 text-right text-slate-400">
                        {o.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} items
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800">₹{o.pricing?.total || 0}</td>
                      <td className="p-4 flex gap-1.5 items-center justify-center">
                        <button
                          onClick={() => handlePrint(o)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                          title="Print Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(o)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {o.customerPhone === "0000000000" && (
                          <button
                            onClick={() => handleDelete(o._id, o.customerPhone)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete Walk-in Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl disabled:opacity-40 text-xs font-semibold text-slate-650 transition-colors shadow-sm"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500 flex items-center px-2">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl disabled:opacity-40 text-xs font-semibold text-slate-650 transition-colors shadow-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden print element */}
      {printOrder && (
        <div className="hidden print:block fixed inset-0 z-50 bg-white text-black p-4 text-[12px] font-mono w-[80mm] leading-tight pos-receipt-print-area">
          <div className="text-center mb-4">
            <h2 className="text-[16px] font-bold uppercase">{billSettings.shopName.text}</h2>
            <p>{billSettings.address.text}</p>
            <p>Phone: {billSettings.phone.text}</p>
            <p className="border-b border-dashed border-black my-2" />
          </div>
          <div className="mb-4">
            <p><b>Order ID:</b> {printOrder.orderId}</p>
            <p><b>Date:</b> {new Date(printOrder.createdAt).toLocaleString()}</p>
            <p><b>Customer:</b> {printOrder.customerName || "Walk-in"}</p>
            <p className="border-b border-dashed border-black my-2" />
          </div>
          <table className="w-full text-left text-[11px] mb-4">
            <thead>
              <tr className="border-b border-black">
                <th>Item</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {printOrder.items?.map((item) => (
                <tr key={item._id} className="border-b border-dashed border-zinc-200">
                  <td>{item.name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">₹{item.price * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 text-right text-[11px] mb-4">
            <div className="flex justify-between">
              <span>GST:</span>
              <span>₹{(printOrder.pricing?.gst || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
              <span>Grand Total:</span>
              <span>₹{(printOrder.pricing?.total || 0).toFixed(2)}</span>
            </div>
          </div>
          <div className="text-center text-[10px] space-y-1">
            <p>Thank You!</p>
          </div>
        </div>
      )}
    </div>
  );
}
