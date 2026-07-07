import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, CreditCard, RefreshCw, Plus, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPOSSupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Action states
  const [actionType, setActionType] = useState("payment"); // "payment" | "debt"
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [note, setNote] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");

  useEffect(() => {
    fetchSupplierLedger();
  }, [id]);

  const fetchSupplierLedger = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getSupplierById(id);
      if (res.data?.success) {
        setSupplier(res.data.supplier);
        setTransactions(res.data.transactions || []);
      }
    } catch {
      toast.error("Failed to load supplier details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAction = async (e) => {
    e.preventDefault();
    const actionAmt = Number(amount);
    if (isNaN(actionAmt) || actionAmt <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    try {
      setLoading(true);
      let res;
      if (actionType === "debt") {
        // Record purchase debt
        res = await adminPosApi.recordSupplierDebt(id, {
          amount: actionAmt,
          invoiceNumber,
          note
        });
      } else {
        // Record payment to supplier
        res = await adminPosApi.recordSupplierPayment(id, {
          amount: actionAmt,
          paymentMethod: payMethod,
          note
        });
      }

      if (res.data?.success) {
        toast.success(`${actionType === "debt" ? "Debt" : "Payment"} recorded successfully!`);
        setAmount("");
        setInvoiceNumber("");
        setNote("");
        fetchSupplierLedger();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setLoading(false);
    }
  };

  if (!supplier) {
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
        onClick={() => navigate("/admin/pos/suppliers")}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Suppliers
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card info & operations */}
        <div className="lg:col-span-1 space-y-6">
          {/* Supplier details card */}
          <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm">
            <h3 className="font-bold text-base text-slate-850 mb-2">{supplier.name}</h3>
            {supplier.gstin && (
              <p className="text-[10px] bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded text-slate-505 w-max mb-4">
                GSTIN: {supplier.gstin}
              </p>
            )}
            <div className="text-xs space-y-1.5 text-slate-400 font-medium">
              <p><b className="text-slate-500">Phone:</b> {supplier.phone || "N/A"}</p>
              <p><b className="text-slate-500">Email:</b> {supplier.email || "N/A"}</p>
              <p><b className="text-slate-500">Address:</b> {supplier.address || "N/A"}</p>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4">
              <span className="text-xs text-slate-400 block mb-0.5 font-medium">Owed Balance</span>
              <span
                className={`text-2xl font-extrabold ${
                  supplier.balance > 0 ? "text-rose-650" : "text-emerald-650"
                }`}
              >
                ₹{supplier.balance || 0}
              </span>
            </div>
          </div>

          {/* Operation form */}
          <div className="bg-white border border-slate-200/85 rounded-3xl p-5 shadow-sm">
            {/* Toggle tabs */}
            <div className="flex border border-slate-200 rounded-xl overflow-hidden mb-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setActionType("payment")}
                className={`flex-1 py-2 text-xs font-bold transition-all ${
                  actionType === "payment"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Record Payment
              </button>
              <button
                type="button"
                onClick={() => setActionType("debt")}
                className={`flex-1 py-2 text-xs font-bold transition-all ${
                  actionType === "debt"
                    ? "bg-rose-600 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Record Debt
              </button>
            </div>

            <form onSubmit={handleSubmitAction} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">
                  {actionType === "debt" ? "Purchase Amount (₹)" : "Payment Amount (₹)"}
                </label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  placeholder="Enter amount"
                />
              </div>

              {actionType === "debt" ? (
                <div>
                  <label className="block text-xs text-slate-500 font-medium mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                    placeholder="Supplier bill invoice ID"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-500 font-medium mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Cash", "Online"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                          payMethod === m
                            ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold"
                            : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                  placeholder="Add details..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-bold transition-all text-xs text-white shadow-lg ${
                  actionType === "debt"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/10"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10"
                }`}
              >
                {actionType === "debt" ? "Add Debt Record" : "Log Supplier Payment"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Ledger transactions list */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-sm font-bold text-slate-800">Supplier Transaction Ledger</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Event Type</th>
                    <th className="p-4 font-semibold">Invoice / Note</th>
                    <th className="p-4 text-right font-semibold">Debit (Debt)</th>
                    <th className="p-4 text-right font-semibold">Credit (Payment)</th>
                    <th className="p-4 text-right font-bold">Owed Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        No transactions recorded
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx._id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="p-4 font-bold">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              tx.type === "Debt"
                                ? "bg-rose-50 text-rose-650 border border-rose-200/60"
                                : "bg-emerald-50 text-emerald-650 border border-emerald-200/60"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-650">
                          {tx.invoiceNumber && <span className="block font-mono">Invoice: {tx.invoiceNumber}</span>}
                          {tx.note && <span>{tx.note}</span>}
                        </td>
                        <td className="p-4 text-right font-bold text-rose-600">
                          {tx.amount > 0 ? `₹${tx.amount}` : "-"}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600">
                          {tx.amount < 0 ? `₹${Math.abs(tx.amount)}` : "-"}
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
