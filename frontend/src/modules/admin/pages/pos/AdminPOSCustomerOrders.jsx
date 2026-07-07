import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, FileText, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPOSCustomerOrders() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, [id]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getCreditHistory(id);
      if (res.data?.success) {
        setCustomer(res.data.customer);
      }
      
      // Fetch invoices of this customer
      const invoiceRes = await adminPosApi.getInvoiceReport({
        customerId: id,
        limit: 100
      });
      if (invoiceRes.data?.success) {
        setOrders(invoiceRes.data.orders || []);
      }
    } catch {
      toast.error("Failed to load customer orders");
    } finally {
      setLoading(false);
    }
  };

  if (!customer) {
    return (
      <div className="p-6 bg-zinc-950 flex justify-center items-center min-h-screen text-white">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-zinc-950 font-outfit text-white min-h-screen">
      {/* Header */}
      <button
        onClick={() => navigate(`/admin/pos/customers/${id}`)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Credit Ledger
      </button>

      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">Order Invoices for {customer.name}</h2>
        <p className="text-xs text-zinc-500">List of all POS purchase orders</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-8 text-center text-zinc-500 text-sm">
          No orders found for this customer
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-850 bg-zinc-950 text-zinc-400">
                  <th className="p-4">Invoice ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4 text-right">Items Count</th>
                  <th className="p-4 text-right font-bold">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="border-b border-zinc-850/50 hover:bg-zinc-950/30">
                    <td className="p-4 font-mono font-semibold text-emerald-400">{o.orderId}</td>
                    <td className="p-4 text-zinc-400">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="p-4">
                      <span className="inline-block bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        {o.posPaymentMethod || "Cash"}
                      </span>
                    </td>
                    <td className="p-4 text-right text-zinc-400">
                      {o.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                    </td>
                    <td className="p-4 text-right font-bold text-white">₹{o.pricing?.total || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
