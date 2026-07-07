import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { sellerApi } from "../../services/sellerApi";

export default function SellerPOSBillSettings() {
  const [settings, setSettings] = useState({
    shopName:  { text: "", enabled: false },
    address:   { text: "", enabled: false },
    phone:     { text: "", enabled: false },
    notes:     { text: "", enabled: false },
    terms:     { text: "", enabled: false },
    gst:       { text: "", enabled: false },
    fssai:     { text: "", enabled: false },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await sellerApi.sellerPos.getBillSettings();
      if (res.data?.success && res.data.billSettings) {
        setSettings(res.data.billSettings);
      }
    } catch {
      toast.error("Failed to load bill settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: !prev[key].enabled,
      },
    }));
  };

  const handleChangeText = (key, text) => {
    setSettings((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        text,
      },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await sellerApi.sellerPos.updateBillSettings({ billSettings: settings });
      if (res.data?.success) {
        toast.success("Receipt invoice settings updated successfully!");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-transparent text-slate-800 min-h-screen">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Receipt Bill Settings</h2>
        <p className="text-xs text-slate-400 font-medium">Configure your seller store thermal invoice receipt layouts</p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shop Name */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">Shop Name</label>
              <input
                type="checkbox"
                checked={settings.shopName?.enabled || false}
                onChange={() => handleToggle("shopName")}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
            <input
              type="text"
              disabled={!settings.shopName?.enabled}
              value={settings.shopName?.text || ""}
              onChange={(e) => handleChangeText("shopName", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          {/* Shop Phone */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">Contact Phone</label>
              <input
                type="checkbox"
                checked={settings.phone?.enabled || false}
                onChange={() => handleToggle("phone")}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
            <input
              type="text"
              disabled={!settings.phone?.enabled}
              value={settings.phone?.text || ""}
              onChange={(e) => handleChangeText("phone", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          {/* Address */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">Shop Address</label>
              <input
                type="checkbox"
                checked={settings.address?.enabled || false}
                onChange={() => handleToggle("address")}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
            <textarea
              rows="2"
              disabled={!settings.address?.enabled}
              value={settings.address?.text || ""}
              onChange={(e) => handleChangeText("address", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors resize-none"
            />
          </div>

          {/* GSTIN */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">GSTIN Number</label>
              <input
                type="checkbox"
                checked={settings.gst?.enabled || false}
                onChange={() => handleToggle("gst")}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
            <input
              type="text"
              disabled={!settings.gst?.enabled}
              value={settings.gst?.text || ""}
              onChange={(e) => handleChangeText("gst", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          {/* FSSAI License */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">FSSAI License</label>
              <input
                type="checkbox"
                checked={settings.fssai?.enabled || false}
                onChange={() => handleToggle("fssai")}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
            <input
              type="text"
              disabled={!settings.fssai?.enabled}
              value={settings.fssai?.text || ""}
              onChange={(e) => handleChangeText("fssai", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          {/* Header Notes */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">Header Notes / Greetings</label>
              <input
                type="checkbox"
                checked={settings.notes?.enabled || false}
                onChange={() => handleToggle("notes")}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
            <input
              type="text"
              disabled={!settings.notes?.enabled}
              value={settings.notes?.text || ""}
              onChange={(e) => handleChangeText("notes", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          {/* Terms & Conditions */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700">Terms & Conditions</label>
              <input
                type="checkbox"
                checked={settings.terms?.enabled || false}
                onChange={() => handleToggle("terms")}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
            <textarea
              rows="2"
              disabled={!settings.terms?.enabled}
              value={settings.terms?.text || ""}
              onChange={(e) => handleChangeText("terms", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 disabled:opacity-40 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-600 transition-colors resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10 text-white"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </form>
    </div>
  );
}
