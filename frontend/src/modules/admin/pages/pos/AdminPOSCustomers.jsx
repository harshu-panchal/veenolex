import { useState, useEffect } from "react";
import { Search, UserPlus, CreditCard, RefreshCw, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPOSCustomers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debtOnly, setDebtOnly] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery, debtOnly]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getCreditCustomers({
        search: searchQuery,
        hasDebtOnly: debtOnly ? "true" : "false"
      });
      if (res.data?.success) {
        setCustomers(res.data.customers || []);
      }
    } catch {
      toast.error("Failed to load credit customers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">POS Credit (Udhaar) Customers</h2>
          <p className="text-xs text-slate-400 font-medium">Manage customers, credit limits, and payments</p>
        </div>
        <button
          onClick={() => navigate("/admin/customers")}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 text-white"
        >
          <UserPlus className="w-4 h-4" />
          Manage Customers Directory
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customers by name, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 transition-colors shadow-sm"
          />
        </div>
        <button
          onClick={() => setDebtOnly(!debtOnly)}
          className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
            debtOnly
              ? "bg-rose-50 border-rose-200 text-rose-600 font-bold"
              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-850"
          }`}
        >
          {debtOnly ? "Showing Debts Only" : "Show Debts Only"}
        </button>
      </div>

      {/* Grid */}
      {loading && customers.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No credit accounts found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div
              key={c._id}
              onClick={() => navigate(`/admin/pos/customers/${c._id}`)}
              className="bg-white border border-slate-200/85 hover:border-slate-350 rounded-3xl p-5 cursor-pointer transition-all flex justify-between items-start group shadow-sm hover:shadow-md"
            >
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 group-hover:text-slate-900 transition-colors">{c.name}</h4>
                <p className="text-xs text-slate-400 font-medium">{c.phone}</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{c.email}</p>
              </div>

              <div className="text-right flex flex-col items-end justify-between h-full">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Credit Balance</span>
                  <span
                    className={`text-sm font-extrabold ${
                      c.creditBalance > 0 ? "text-rose-650" : "text-emerald-650"
                    }`}
                  >
                    ₹{c.creditBalance || 0}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-1 text-[11px] font-bold text-emerald-600 group-hover:text-emerald-700 group-hover:underline">
                  View Ledger
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
