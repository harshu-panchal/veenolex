import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, CreditCard, Calendar, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPOSCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Payment inputs
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  // PhonePe online repayment status
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [merchantOrderId, setMerchantOrderId] = useState(null);

  useEffect(() => {
    fetchLedger();
  }, [id]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getCreditHistory(id);
      if (res.data?.success) {
        setCustomer(res.data.customer);
        setTransactions(res.data.transactions || []);
      }
    } catch {
      toast.error("Failed to load customer credit history");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const payAmt = Number(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      toast.error("Please enter a valid positive payment amount");
      return;
    }

    try {
      setLoading(true);

      if (paymentMethod === "Online") {
        // PhonePe Online credit repayment initiation
        const res = await adminPosApi.initiateOnlineCreditPayment({
          customerId: id,
          amount: payAmt,
          redirectUrl: `${window.location.origin}/admin/pos/customers/${id}?orderId={merchantOrderId}`
        });

        if (res.data?.success) {
          setPaymentUrl(res.data.redirectUrl);
          setMerchantOrderId(res.data.merchantOrderId);
          toast.success("Repayment checkout link generated");
        }
        return;
      }

      // Cash/offline payment
      const res = await adminPosApi.recordCreditPayment({
        customerId: id,
        amount: payAmt,
        paymentMethod,
        note
      });

      if (res.data?.success) {
        toast.success("Payment recorded successfully!");
        setAmount("");
        setNote("");
        fetchLedger();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  const verifyOnlineRepayment = async () => {
    if (!merchantOrderId) return;
    try {
      setLoading(true);
      const res = await adminPosApi.verifyOnlineCreditPayment(merchantOrderId);
      if (res.data?.success) {
        toast.success("PhonePe repayment verified successfully!");
        setPaymentUrl(null);
        setMerchantOrderId(null);
        setAmount("");
        setNote("");
        fetchLedger();
      } else {
        toast.error("Payment status is still Pending or Failed. Retry verification.");
      }
    } catch {
      toast.error("Failed to verify online repayment");
    } finally {
      setLoading(false);
    }
  };

  if (!customer) {
    return (
      <div className="p-6 bg-transparent flex justify-center items-center min-h-screen text-slate-800">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      {/* Header */}
      <button
        onClick={() => navigate("/admin/pos/customers")}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Credit Customers
      </button>

      {/* Grid wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer Info and Repayment widget */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card */}
          <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-850">{customer.name}</h3>
                <p className="text-xs text-slate-400 font-medium">{customer.phone}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4">
              <span className="text-xs text-slate-400 block mb-0.5 font-medium">Outstanding Balance (Udhaar)</span>
              <span
                className={`text-2xl font-extrabold ${
                  customer.creditBalance > 0 ? "text-rose-650" : "text-emerald-650"
                }`}
              >
                ₹{customer.creditBalance || 0}
              </span>
            </div>
          </div>

          {/* Record payment widget */}
          <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-850 mb-4">Record Payment Repayment</h4>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Repayment Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  placeholder="Enter amount to pay"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 font-medium mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Cash", "Online"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                        paymentMethod === m
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold"
                          : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === "Cash" ? (
                <div>
                  <label className="block text-xs text-slate-500 font-medium mb-1">Notes / Remarks</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                    placeholder="E.g. Received partial cash"
                  />
                </div>
              ) : paymentUrl ? (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-750 text-xs p-3 rounded-xl space-y-3 text-center">
                  <p className="font-semibold">Complete payment via PhonePe gateway</p>
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-lg text-white text-xs block transition-all shadow-md shadow-emerald-600/10"
                  >
                    Open Payment Session
                  </a>
                  <button
                    type="button"
                    onClick={verifyOnlineRepayment}
                    className="flex items-center justify-center gap-1 mx-auto text-[11px] text-emerald-650 hover:text-emerald-700 underline mt-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Verify Completion
                  </button>
                </div>
              ) : null}

              {!paymentUrl && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-all text-white text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10"
                >
                  <CreditCard className="w-4 h-4" />
                  {paymentMethod === "Online" ? "Initiate Repayment" : "Record Cash Repayment"}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right: Ledger History */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-sm font-bold text-slate-800">Credit Ledger Entries</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Transaction Type</th>
                    <th className="p-4 font-semibold">Reference</th>
                    <th className="p-4 text-right font-semibold">Adjustment</th>
                    <th className="p-4 text-right font-bold">Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400">
                        No credit transaction history
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx._id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="p-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              tx.type === "Order"
                                ? "bg-rose-50 text-rose-650 border border-rose-200/60"
                                : tx.type === "Payment"
                                ? "bg-emerald-50 text-emerald-650 border border-emerald-200/60"
                                : "bg-slate-50 text-slate-650 border border-slate-200/50"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-4">
                          {tx.order ? (
                            <span className="font-mono text-slate-600">Order ID: {tx.order?.orderId}</span>
                          ) : (
                            <span className="text-slate-400">{tx.note || "Manual adjustment"}</span>
                          )}
                        </td>
                        <td
                          className={`p-4 text-right font-bold ${
                            tx.amount > 0 ? "text-rose-650" : "text-emerald-650"
                          }`}
                        >
                          {tx.amount > 0 ? `+ ₹${tx.amount}` : `- ₹${Math.abs(tx.amount)}`}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800">₹{tx.balanceAfter}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
