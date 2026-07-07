import { useState, useEffect } from "react";
import { Search, FileText, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import adminPosApi from "../../services/api/posApi";

export default function AdminPurchaseReport() {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const res = await adminPosApi.getPurchaseEntries({ type: "purchase" });
      if (res.data?.success) {
        setEntries(res.data.entries || []);
      }
    } catch {
      toast.error("Failed to load purchase reports");
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
          <title>Purchase Invoice Draft</title>
          <style>
            body { font-family: monospace; padding: 20px; line-height: 1.4; }
            h2 { text-align: center; text-transform: uppercase; margin-bottom: 5px; }
            p { text-align: center; margin: 0 0 15px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total-row { font-weight: bold; text-align: right; }
          </style>
        </head>
        <body>
          <h2>Purchase Receipt</h2>
          <p>Date: ${new Date(entry.createdAt).toLocaleDateString()}<br>Ref ID: ${entry._id}</p>

          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Qty Received</th>
                <th>Cost Price</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>Rs. ${Number(item.price || item.purchasePrice || 0).toFixed(2)}</td>
                  <td>Rs. ${(Number(item.price || item.purchasePrice || 0) * Number(item.quantity || 0)).toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Total Outlay:</td>
                <td>Rs. ${Number(data.total || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Purchase Logs Report</h2>
        <p className="text-xs text-slate-400 font-medium">History of incoming stock warehouse purchases</p>
      </div>

      {loading && entries.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-sm shadow-sm">
          No purchases recorded
        </div>
      ) : (
        <div className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                  <th className="p-4 font-semibold">Ref ID</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 text-right font-semibold">Items Count</th>
                  <th className="p-4 text-right font-bold">Total Cost</th>
                  <th className="p-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                    <td className="p-4 font-mono font-bold text-emerald-650">{e._id.slice(-10)}</td>
                    <td className="p-4 text-slate-400 font-medium">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="p-4 text-right text-slate-650 font-medium">
                      {e.data?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0} items
                    </td>
                    <td className="p-4 text-right font-extrabold text-slate-850">₹{e.data?.total || 0}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handlePrint(e)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold"
                        title="Print Purchase Summary"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>
                    </td>
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
