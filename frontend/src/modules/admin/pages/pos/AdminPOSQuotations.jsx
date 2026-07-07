import { useState, useEffect } from "react";
import { Search, FileText, Trash2, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPOSQuotations() {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [type, setType] = useState("quotation"); // "quotation" | "purchase"

  useEffect(() => {
    fetchEntries();
  }, [type]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getPurchaseEntries({ type });
      if (res.data?.success) {
        setEntries(res.data.entries || []);
      }
    } catch {
      toast.error("Failed to load drafts");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this draft?")) return;
    try {
      setLoading(true);
      const res = await adminPosApi.deletePurchaseEntry(id);
      if (res.data?.success) {
        toast.success("Draft deleted successfully");
        fetchEntries();
      }
    } catch {
      toast.error("Failed to delete draft");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (entry) => {
    const printWindow = window.open("", "_blank");
    const data = entry.data || {};
    const items = data.items || [];

    printWindow.document.write(`
      <html>
        <head>
          <title>${entry.type === "quotation" ? "Quotation" : "Purchase Draft"}</title>
          <style>
            body { font-family: monospace; padding: 20px; line-height: 1.4; color: #000; }
            h2 { text-align: center; text-transform: uppercase; margin-bottom: 5px; }
            p { text-align: center; margin: 0 0 15px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total-row { font-weight: bold; text-align: right; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; }
          </style>
        </head>
        <body>
          <h2>${entry.type === "quotation" ? "Quotation Estimate" : "Purchase Draft"}</h2>
          <p>Draft Date: ${new Date(entry.createdAt).toLocaleDateString()}<br>Ref ID: ${entry._id}</p>

          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>Rs. ${Number(item.price || 0).toFixed(2)}</td>
                  <td>Rs. ${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Grand Total:</td>
                <td>Rs. ${Number(data.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>This is a computer generated document. No signature required.</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Quotation & Purchase Drafts</h2>
        <p className="text-xs text-slate-400 font-medium">Manage estimates and warehouse incoming entries drafts</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 bg-transparent">
        <button
          onClick={() => setType("quotation")}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
            type === "quotation"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Quotations Estimates
        </button>
        <button
          onClick={() => setType("purchase")}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 ${
            type === "purchase"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Purchase Drafts
        </button>
      </div>

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No drafts found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map((e) => (
            <div
              key={e._id}
              className="bg-white border border-slate-200/85 rounded-3xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200/60">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Ref ID: {e._id.slice(-8)}</h4>
                    <p className="text-xs text-slate-400 font-medium">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-emerald-650">₹{e.data?.total || 0}</span>
              </div>

              {/* Items Summary list */}
              <div className="text-xs text-slate-600 space-y-1 mb-4 border-t border-b border-slate-100 py-3">
                {e.data?.items?.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate max-w-[200px]">{item.name}</span>
                    <span>x{item.quantity}</span>
                  </div>
                ))}
                {(e.data?.items?.length || 0) > 3 && (
                  <p className="text-[10px] text-slate-400 text-right font-medium">+ {(e.data?.items?.length || 0) - 3} more items</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handlePrint(e)}
                  className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-650 hover:text-slate-800 font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Draft
                </button>
                <button
                  onClick={() => handleDelete(e._id)}
                  className="p-2.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
