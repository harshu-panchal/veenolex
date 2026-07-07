import { useState, useEffect } from "react";
import { Save, RefreshCw, Barcode } from "lucide-react";
import { toast } from "sonner";

export default function AdminBarcodeSettings() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    width: 38,
    height: 25,
    fontSize: 8,
    barcodeHeight: 30,
    barcodeWidth: 1.5,
    showPrice: true,
    showName: true,
    mrpLabel: "MRP",
    spLabel: "SP",
  });

  useEffect(() => {
    // Load local storage barcode settings
    const stored = localStorage.getItem("admin_pos_barcode_settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        // Fallback to default
      }
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setLoading(true);
    localStorage.setItem("admin_pos_barcode_settings", JSON.stringify(settings));
    toast.success("Barcode print dimensions updated successfully!");
    setLoading(false);
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen font-sans">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Barcode Label Dimensions</h2>
        <p className="text-xs text-slate-400 font-medium">Configure barcode sticker printing layouts</p>
      </div>

      <form onSubmit={handleSave} className="max-w-md bg-white border border-slate-200/85 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Barcode className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Dimensions (mm)</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">Label Width (mm)</label>
            <input
              type="number"
              required
              value={settings.width}
              onChange={(e) => setSettings({ ...settings, width: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">Label Height (mm)</label>
            <input
              type="number"
              required
              value={settings.height}
              onChange={(e) => setSettings({ ...settings, height: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          <div className="space-y-1.5 col-span-2 flex items-center gap-2 pb-2 pt-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Barcode styling</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-505">Barcode Height (px)</label>
            <input
              type="number"
              required
              value={settings.barcodeHeight}
              onChange={(e) => setSettings({ ...settings, barcodeHeight: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-505">Barcode Line Width</label>
            <input
              type="number"
              step="0.1"
              required
              value={settings.barcodeWidth}
              onChange={(e) => setSettings({ ...settings, barcodeWidth: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-505">Text Font Size (px)</label>
            <input
              type="number"
              required
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          <div className="space-y-1.5 col-span-2 flex items-center gap-2 pb-2 pt-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Display Details</span>
          </div>

          <div className="flex items-center justify-between col-span-2 py-1">
            <label className="text-xs font-bold text-slate-700">Show Selling Price on Label</label>
            <input
              type="checkbox"
              checked={settings.showPrice}
              onChange={(e) => setSettings({ ...settings, showPrice: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
          </div>

          <div className="flex items-center justify-between col-span-2 py-1">
            <label className="text-xs font-bold text-slate-700">Show Product Name on Label</label>
            <input
              type="checkbox"
              checked={settings.showName}
              onChange={(e) => setSettings({ ...settings, showName: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 text-white shadow-md shadow-emerald-600/10"
        >
          <Save className="w-4 h-4" />
          Save Dimensions
        </button>
      </form>
    </div>
  );
}
