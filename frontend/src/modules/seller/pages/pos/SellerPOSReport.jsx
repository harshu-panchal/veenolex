import { useState, useEffect } from "react";
import { Search, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { sellerApi } from "../../services/sellerApi";

export default function SellerPOSReport() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    fetchInvoices();
  }, [startDate, endDate]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.sellerPos.getInvoiceReport({ startDate, endDate });
      if (res.data?.success) {
        const list = res.data.orders || [];
        setOrders(list);
        // Compute total
        const sum = list.reduce(
          (acc, o) => acc + (o.pricing?.total || o.paymentBreakdown?.grandTotal || 0),
          0
        );
        setTotalSales(sum);
      }
    } catch {
      toast.error("Failed to load invoice reports");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">POS Sales Reports</h2>
          <p className="text-xs text-slate-400 font-medium">Track your cashier orders and total sales</p>
        </div>
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

      <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 mb-6 max-w-sm">
        <span className="text-xs text-slate-500 block mb-1">Total Sales Outlay</span>
        <span className="text-2xl font-bold text-emerald-600">₹{totalSales.toFixed(2)}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-4">Invoice ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Method</th>
                  <th className="p-4 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      No invoices found for this range
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o._id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 font-mono font-semibold text-slate-900">{o.orderId}</td>
                      <td className="p-4 text-slate-500">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="p-4 text-slate-700">{o.customerName || "Walk-in"}</td>
                      <td className="p-4">
                        <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {o.posPaymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900">₹{o.pricing?.total || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
