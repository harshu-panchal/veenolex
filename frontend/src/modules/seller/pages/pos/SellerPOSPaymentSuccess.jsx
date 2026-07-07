import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, RefreshCw, XCircle, Printer, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@core/api/axios";

export default function SellerPOSPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [success, setSuccess] = useState(false);
  const [billSettings, setBillSettings] = useState({});

  const orderId = searchParams.get("orderId") || searchParams.get("id");

  useEffect(() => {
    if (orderId) {
      verifyPayment();
      fetchBillSettings();
    } else {
      setLoading(false);
      toast.error("No transaction order identifier found");
    }
  }, [orderId]);

  const verifyPayment = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.post("/seller/pos/orders/verify", { orderId });
      if (res.data?.success) {
        setOrder(res.data.order);
        setSuccess(true);
        toast.success("PhonePe payment verified successfully!");
      } else {
        setSuccess(false);
        toast.error("Payment status verification failed");
      }
    } catch {
      setSuccess(false);
      toast.error("Failed to verify transaction status");
    } finally {
      setLoading(false);
    }
  };

  const fetchBillSettings = async () => {
    try {
      const res = await axiosInstance.get("/seller/pos/bill-settings");
      if (res.data?.success) {
        setBillSettings(res.data.billSettings || {});
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-zinc-950 text-white min-h-screen font-outfit">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-850 rounded-2xl p-6 text-center shadow-2xl">
        {loading ? (
          <div className="py-12 space-y-4">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
            <p className="text-zinc-400 text-sm">Verifying payment status...</p>
          </div>
        ) : success ? (
          <div className="space-y-6">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
            <div>
              <h3 className="text-xl font-bold">Payment Successful!</h3>
              <p className="text-xs text-zinc-500 mt-1">POS Online Invoice: {order?.orderId}</p>
              <p className="text-sm font-extrabold text-emerald-400 mt-3">Amount Received: ₹{order?.pricing?.total}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.print()}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg text-white"
              >
                <Printer className="w-4 h-4" />
                Print Cashier Receipt
              </button>
              <button
                onClick={() => navigate("/seller/pos/orders")}
                className="w-full py-3 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-bold transition-all text-zinc-300"
              >
                <ShoppingBag className="w-4 h-4 inline mr-1" />
                New POS Sale
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <XCircle className="w-16 h-16 text-rose-400 mx-auto" />
            <div>
              <h3 className="text-xl font-bold">Transaction Failed</h3>
              <p className="text-xs text-zinc-500 mt-1">Reference Code: {orderId}</p>
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl mt-4">
                The payment attempt failed, cancelled, or was declined.
              </p>
            </div>

            <button
              onClick={() => navigate("/seller/pos/orders")}
              className="w-full py-3 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-bold transition-all text-zinc-300"
            >
              Return to Billing Screen
            </button>
          </div>
        )}
      </div>

      {/* Hidden print element */}
      {success && order && (
        <div className="hidden print:block fixed inset-0 z-50 bg-white text-black p-4 text-[12px] font-mono w-[80mm] leading-tight pos-receipt-print-area">
          <div className="text-center mb-4">
            <h2 className="text-[16px] font-bold uppercase">{billSettings.shopName?.text || "STORE"}</h2>
            <p>{billSettings.address?.text || ""}</p>
            <p>Phone: {billSettings.phone?.text || ""}</p>
            <p className="border-b border-dashed border-black my-2" />
          </div>
          <div className="mb-4">
            <p><b>Order ID:</b> {order.orderId}</p>
            <p><b>Date:</b> {new Date(order.createdAt).toLocaleString()}</p>
            <p><b>Customer:</b> {order.customerName || "Walk-in"}</p>
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
              {order.items?.map((item) => (
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
              <span>GST Total:</span>
              <span>₹{(order.pricing?.gst || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
              <span>Grand Total:</span>
              <span>₹{(order.pricing?.total || 0).toFixed(2)}</span>
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
