import { useState, useEffect } from "react";
import { Search, Plus, CreditCard, RefreshCw, X, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPOSSuppliers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Add Supplier Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");

  useEffect(() => {
    fetchSuppliers();
  }, [searchQuery]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getSuppliers({ search: searchQuery });
      if (res.data?.success) {
        setSuppliers(res.data.suppliers || []);
      }
    } catch {
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setLoading(true);
      const res = await adminPosApi.createSupplier({ name, phone, email, address, gstin });
      if (res.data?.success) {
        toast.success("Supplier added successfully");
        setShowAddModal(false);
        setName("");
        setPhone("");
        setEmail("");
        setAddress("");
        setGstin("");
        fetchSuppliers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add supplier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">POS Supplier Ledgers</h2>
          <p className="text-xs text-slate-400 font-medium">Track raw materials procurement debt and balances</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 text-white"
        >
          <Plus className="w-4 h-4" />
          Add New Supplier
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search suppliers by name, phone, or GSTIN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-800 focus:outline-none focus:border-emerald-600 transition-colors shadow-sm"
        />
      </div>

      {/* Suppliers Grid */}
      {loading && suppliers.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No suppliers found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div
              key={s._id}
              onClick={() => navigate(`/admin/pos/suppliers/${s._id}`)}
              className="bg-white border border-slate-200/85 hover:border-slate-350 rounded-3xl p-5 cursor-pointer transition-all flex justify-between items-start group shadow-sm hover:shadow-md"
            >
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-800 group-hover:text-slate-900 transition-colors">{s.name}</h4>
                {s.gstin && <p className="text-[10px] bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded text-slate-500 w-max">GST: {s.gstin}</p>}
                <p className="text-xs text-slate-400 font-medium">{s.phone || "No phone"}</p>
              </div>

              <div className="text-right flex flex-col items-end justify-between h-full">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Owed Balance</span>
                  <span
                    className={`text-sm font-extrabold ${
                      s.balance > 0 ? "text-rose-650" : "text-emerald-650"
                    }`}
                  >
                    ₹{s.balance || 0}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-1 text-[11px] font-bold text-emerald-600 group-hover:text-emerald-700 group-hover:underline">
                  Supplier Ledger
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form
            onSubmit={handleAddSupplier}
            className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl p-6 text-slate-800 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-base font-bold text-slate-900">Add Supplier</h4>
              <X
                className="w-5 h-5 text-slate-400 hover:text-slate-605 cursor-pointer"
                onClick={() => setShowAddModal(false)}
              />
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">Supplier GSTIN</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-all text-white text-xs shadow-lg shadow-emerald-600/10"
            >
              Add Supplier
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
