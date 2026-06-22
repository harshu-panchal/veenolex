import React, { useEffect, useState } from "react";
import Card from "@shared/components/ui/Card";
import { useToast } from "@shared/components/ui/Toast";
import { useSettings } from "@core/context/SettingsContext";
import { adminApi } from "../services/adminApi";
import {
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
  Megaphone,
  Eye,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PromoStripManagement() {
  const { refetch } = useSettings();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const res = await adminApi.getSettings();
        const data = res.data?.result ?? res.data;
        if (data) {
          setMessages(Array.isArray(data.promoMessages) ? data.promoMessages : []);
        }
      } catch (error) {
        console.error("Failed to load settings", error);
        showToast("Failed to load promo strip configurations", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [showToast]);

  const handleAdd = (e) => {
    e.preventDefault();
    const clean = newMsg.trim();
    if (!clean) return;
    if (clean.length > 200) {
      showToast("Message cannot exceed 200 characters", "warning");
      return;
    }
    if (messages.includes(clean)) {
      showToast("This message is already in the list", "warning");
      return;
    }
    setMessages((prev) => [...prev, clean]);
    setNewMsg("");
    showToast("Message added to preview", "info");
  };

  const handleDelete = (indexToDelete) => {
    setMessages((prev) => prev.filter((_, idx) => idx !== indexToDelete));
    showToast("Message removed from preview", "info");
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    setMessages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveDown = (index) => {
    if (index === messages.length - 1) return;
    setMessages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await adminApi.updateSettings({ promoMessages: messages });
      await refetch({ forceRefresh: true });
      showToast("Promo strip updated successfully", "success");
    } catch (error) {
      console.error("Failed to save settings", error);
      showToast(error.response?.data?.message || "Failed to save settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 px-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 mb-8">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Promo Strip Settings
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
          </h1>
          <p className="ds-description mt-1">Configure announcement messages scrolling dynamically on the homepage marquee.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className={cn(
            "flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {isLoading ? (
        <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Live Preview Widget */}
          <Card className="border-none shadow-md bg-white rounded-2xl p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Storefront Live Preview
              </span>
            </div>

            {messages.length > 0 ? (
              <div className="w-full rounded-xl overflow-hidden border border-emerald-800 shadow-[0_4px_12px_rgba(46,125,50,0.15)]">
                <div 
                  style={{ backgroundColor: "#2E7D32", borderColor: "#236326" }}
                  className="relative overflow-hidden py-3 border-y select-none"
                >
                  <div className="classic-marquee-track flex w-max items-center gap-6 px-4 text-sm font-semibold text-white -translate-y-[1px]">
                    {[...messages, ...messages].map((message, idx) => (
                      <React.Fragment key={`${message}-${idx}`}>
                        <span className="whitespace-nowrap">{message}</span>
                        <span className="text-white/60">•</span>
                      </React.Fragment>
                    ))}
                    <span className="whitespace-nowrap">❤️</span>
                    <span className="whitespace-nowrap">🎁</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center justify-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <AlertCircle className="h-6 w-6 text-slate-400 mb-2" />
                <p className="text-sm font-bold text-slate-700">Promo Strip is Disabled</p>
                <p className="text-xs text-slate-400 mt-1">If the message list is empty, the promo strip will not render on the customer homepage.</p>
              </div>
            )}
          </Card>

          {/* Add Message Form & List Manager */}
          <Card className="border-none shadow-md bg-white rounded-2xl p-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-slate-500" />
              Manage Announcements
            </h3>

            {/* Input Form */}
            <form onSubmit={handleAdd} className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Enter custom announcement text (e.g., Flat 20% Off this weekend!)"
                  maxLength={200}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  {newMsg.length}/200
                </span>
              </div>
              <button
                type="submit"
                disabled={!newMsg.trim()}
                className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-30 disabled:pointer-events-none shadow-md shadow-slate-900/10"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </form>

            {/* Message List */}
            {messages.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <span className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-sm font-bold text-slate-800 break-words line-clamp-2">
                        {message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Action buttons */}
                      <button
                        type="button"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === messages.length - 1}
                        title="Move Down"
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        title="Delete announcement"
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <p className="text-sm font-bold text-slate-400">No announcement messages added yet.</p>
                <p className="text-xs text-slate-400 mt-1">Create one using the text input above to populate the strip.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
