import { useState, useEffect } from "react";
import { Search, Calendar, FileText, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPOSReport() {
  const [activeTab, setActiveTab] = useState("sales"); // "sales" | "ledger"
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [summary, setSummary] = useState({ totalSales: 0, totalTax: 0, orderCount: 0 });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (activeTab === "sales") {
      fetchReport();
    } else {
      fetchStockLedger();
    }
  }, [activeTab, startDate, endDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getPOSReport({ startDate, endDate });
      if (res.data?.success) {
        setOrders(res.data.orders || []);
        setSummary(res.data.summary || { totalSales: 0, totalTax: 0, orderCount: 0 });
      }
    } catch {
      toast.error("Failed to load POS report");
    } finally {
      setLoading(false);
    }
  };

  const fetchStockLedger = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getStockLedger({ search: searchQuery });
      if (res.data?.success) {
        setLedger(res.data.entries || []);
      }
    } catch {
      toast.error("Failed to load stock ledger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">POS Reports & Ledgers</h2>
          <p className="text-xs text-slate-400 font-medium">Track cashier orders and inventory history</p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent focus:outline-none text-slate-800"
          />
          <span className="text-slate-400 font-medium">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent focus:outline-none text-slate-800"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab("sales")}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === "sales"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          POS Sales Summary
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
            activeTab === "ledger"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Inventory Stock Ledger
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
        </div>
      ) : activeTab === "sales" ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm">
              <span className="text-xs text-slate-400 block mb-1 font-medium">Total POS Sales</span>
              <span className="text-2xl font-bold text-emerald-600">₹{summary.totalSales}</span>
            </div>
            <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm">
              <span className="text-xs text-slate-400 block mb-1 font-medium">GST Collected</span>
              <span className="text-2xl font-bold text-slate-800">₹{summary.totalTax}</span>
            </div>
            <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm">
              <span className="text-xs text-slate-400 block mb-1 font-medium">Total Invoices</span>
              <span className="text-2xl font-bold text-slate-800">{summary.orderCount}</span>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">Invoices List</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    <th className="p-4 font-semibold">Invoice ID</th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Customer</th>
                    <th className="p-4 font-semibold">Method</th>
                    <th className="p-4 text-right font-semibold">GST</th>
                    <th className="p-4 text-right font-bold">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        No invoices found for this range
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o._id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 font-mono font-semibold text-emerald-600">{o.orderId}</td>
                        <td className="p-4 text-slate-400">{new Date(o.createdAt).toLocaleString()}</td>
                        <td className="p-4 text-slate-800 font-medium">{o.customerName || "Walk-in"}</td>
                        <td className="p-4">
                          <span className="inline-block bg-slate-50 text-slate-650 border border-slate-200/60 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {o.posPaymentMethod || "Cash"}
                          </span>
                        </td>
                        <td className="p-4 text-right text-slate-400">₹{o.pricing?.gst || 0}</td>
                        <td className="p-4 text-right font-bold text-slate-800">₹{o.pricing?.total || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stock Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ledger by product name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchStockLedger()}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 transition-colors shadow-sm"
            />
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Product Name</th>
                    <th className="p-4 font-semibold">Sku</th>
                    <th className="p-4 font-semibold">Adjustment</th>
                    <th className="p-4 font-semibold">Source</th>
                    <th className="p-4 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        No ledger entries found
                      </td>
                    </tr>
                  ) : (
                    ledger.map((entry) => (
                      <tr key={entry._id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 text-slate-400">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="p-4 font-bold text-slate-800">
                          {entry.productName}
                          {entry.variant && <span className="block text-[10px] text-slate-400">({entry.variant})</span>}
                        </td>
                        <td className="p-4 text-slate-400 font-mono">{entry.sku || "-"}</td>
                        <td className="p-4">
                          <span
                            className={`flex items-center gap-0.5 font-bold ${
                              entry.type === "IN" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {entry.type === "IN" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {entry.quantity}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="inline-block bg-slate-50 text-slate-650 border border-slate-200/60 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {entry.source}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 max-w-[200px] truncate">{entry.note || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
