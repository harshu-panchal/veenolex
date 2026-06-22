import React, { useEffect, useState, useMemo } from "react";
import Card from "@shared/components/ui/Card";
import { useToast } from "@shared/components/ui/Toast";
import Modal from "@shared/components/ui/Modal";
import { adminApi } from "../services/adminApi";
import {
  Save,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Eye,
  AlertCircle,
  Calendar,
  Sparkles,
  Smartphone,
  Link2,
  X,
  FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINK_TYPES = [
  { id: "none", label: "No Redirect" },
  { id: "header", label: "Header Category Page" },
  { id: "category", label: "Main Category" },
  { id: "subcategory", label: "Subcategory" },
  { id: "product", label: "Product Detail" },
  { id: "url", label: "External URL" },
];

export default function PopupManagement() {
  const { showToast } = useToast();
  const [popups, setPopups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Master Data
  const [headers, setHeaders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    linkType: "none",
    linkValue: "",
    isActive: true,
    showOnce: true,
    startDate: "",
    endDate: "",
  });

  // Fetch Master Data for Redirection Helpers
  const fetchMasterData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        adminApi.getCategories().catch(() => ({ data: { results: [] } })),
        adminApi.getProducts({ limit: 200 }).catch(() => ({ data: { result: { items: [] } } })),
      ]);

      const catList = catRes.data?.results || catRes.data?.result || [];
      if (Array.isArray(catList)) {
        setHeaders(catList.filter((c) => c.type === "header"));
        setCategories(catList.filter((c) => c.type === "category"));
        setSubcategories(catList.filter((c) => c.type === "subcategory"));
      }

      const rawProducts = prodRes.data?.result?.items || prodRes.data?.result || [];
      setProducts(Array.isArray(rawProducts) ? rawProducts : []);
    } catch (error) {
      console.error("Failed to fetch master data:", error);
    }
  };

  // Fetch Popups list
  const fetchPopups = async () => {
    try {
      setIsLoading(true);
      const res = await adminApi.getPopups();
      const items = res.data?.result?.items || res.data?.results || res.data || [];
      setPopups(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error("Failed to load popups", error);
      showToast("Failed to load popups", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
    fetchPopups();
  }, []);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
      linkType: "none",
      linkValue: "",
      isActive: true,
      showOnce: true,
      startDate: "",
      endDate: "",
    });
  };

  const handleCreateNew = () => {
    setEditingPopup(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (popup) => {
    setEditingPopup(popup);
    setFormData({
      title: popup.title || "",
      description: popup.description || "",
      imageUrl: popup.imageUrl || "",
      linkType: popup.linkType || "none",
      linkValue: popup.linkValue || "",
      isActive: popup.isActive !== false,
      showOnce: popup.showOnce !== false,
      startDate: popup.startDate ? new Date(popup.startDate).toISOString().split("T")[0] : "",
      endDate: popup.endDate ? new Date(popup.endDate).toISOString().split("T")[0] : "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this popup?")) return;
    try {
      await adminApi.deletePopup(id);
      showToast("Popup deleted successfully", "success");
      setPopups((prev) => prev.filter((p) => p._id !== id));
    } catch (error) {
      console.error(error);
      showToast("Failed to delete popup", "error");
    }
  };

  const handleToggleActive = async (popup) => {
    try {
      const nextStatus = !popup.isActive;
      await adminApi.updatePopup(popup._id, { isActive: nextStatus });
      showToast(`Popup ${nextStatus ? "activated" : "deactivated"} successfully`, "success");
      setPopups((prev) =>
        prev.map((p) => (p._id === popup._id ? { ...p, isActive: nextStatus } : p))
      );
    } catch (error) {
      console.error(error);
      showToast("Failed to update status", "error");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) {
      showToast("Image size cannot exceed 10MB", "warning");
      return;
    }

    const formDataObj = new FormData();
    formDataObj.append("image", file);

    try {
      setIsUploading(true);
      const res = await adminApi.uploadPopupImage(formDataObj);
      const uploadedUrl = res.data?.result?.url || res.data?.url;
      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, imageUrl: uploadedUrl }));
        showToast("Image uploaded successfully", "success");
      }
    } catch (error) {
      console.error("Upload failed", error);
      showToast("Failed to upload image", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Title is required", "warning");
      return;
    }
    if (!formData.imageUrl.trim()) {
      showToast("Popup Image is required", "warning");
      return;
    }

    const payload = {
      ...formData,
      startDate: formData.startDate ? new Date(formData.startDate) : null,
      endDate: formData.endDate ? new Date(formData.endDate) : null,
    };

    try {
      setIsSaving(true);
      if (editingPopup) {
        const res = await adminApi.updatePopup(editingPopup._id, payload);
        const updated = res.data?.result || res.data;
        showToast("Popup updated successfully", "success");
        setPopups((prev) => prev.map((p) => (p._id === editingPopup._id ? updated : p)));
      } else {
        const res = await adminApi.createPopup(payload);
        const created = res.data?.result || res.data;
        showToast("Popup created successfully", "success");
        setPopups((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.message || "Failed to save popup", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Redirection Link values lookup helper for displaying details in list
  const getLinkDisplayValue = (type, val) => {
    if (type === "none" || !val) return "No Redirect";
    if (type === "header") {
      const match = headers.find((h) => h._id === val);
      return `Header: ${match?.name || val}`;
    }
    if (type === "category") {
      const match = categories.find((c) => c._id === val);
      return `Category: ${match?.name || val}`;
    }
    if (type === "subcategory") {
      const match = subcategories.find((s) => s._id === val);
      return `Subcategory: ${match?.name || val}`;
    }
    if (type === "product") {
      const match = products.find((p) => p._id === val);
      return `Product: ${match?.name || val}`;
    }
    return `URL: ${val}`;
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 px-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 mb-8">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Marketing Popups
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
          </h1>
          <p className="ds-description mt-1">
            Configure seasonal or event-based popups overlaying the home page when customers first visit.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-95 hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Create Popup
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Popups List (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {isLoading ? (
            <Card className="border-none shadow-md bg-white rounded-2xl p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-slate-800 animate-spin" />
            </Card>
          ) : popups.length > 0 ? (
            <div className="space-y-4">
              {popups.map((popup) => (
                <Card
                  key={popup._id}
                  className={cn(
                    "border border-slate-100 shadow-md bg-white rounded-2xl p-5 hover:shadow-lg transition-all group relative overflow-hidden",
                    !popup.isActive && "bg-slate-50/50"
                  )}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    {/* Thumbnail */}
                    <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-100 shrink-0 bg-slate-100 relative group-hover:scale-[1.02] transition-transform">
                      {popup.imageUrl ? (
                        <img
                          src={popup.imageUrl}
                          alt={popup.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-300">
                          <FileImage className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 truncate">
                          {popup.title}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleActive(popup)}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors",
                              popup.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                            )}
                          >
                            {popup.isActive ? "Active" : "Inactive"}
                          </button>
                          {popup.showOnce && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-widest">
                              Show Once
                            </span>
                          )}
                        </div>
                      </div>

                      {popup.description && (
                        <p className="text-xs text-slate-400 font-bold mt-1 line-clamp-2">
                          {popup.description}
                        </p>
                      )}

                      {/* Scheduling & Redirection details */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-3 pt-3 border-t border-slate-50 text-[10px] font-bold text-slate-500">
                        <div className="flex items-center gap-1">
                          <Link2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{getLinkDisplayValue(popup.linkType, popup.linkValue)}</span>
                        </div>
                        {(popup.startDate || popup.endDate) ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              {popup.startDate ? new Date(popup.startDate).toLocaleDateString() : "Always"}
                              {" - "}
                              {popup.endDate ? new Date(popup.endDate).toLocaleDateString() : "Always"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>Always Scheduled</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleEdit(popup)}
                        title="Edit Popup"
                        className="p-2.5 text-slate-400 hover:text-black hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <Edit3 className="h-4.5 w-4.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(popup._id)}
                        title="Delete Popup"
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500">No popups configured yet.</p>
              <p className="text-xs text-slate-400 mt-1">Create one using the button above.</p>
            </div>
          )}
        </div>

        {/* Live Mockup Preview (4 Cols) */}
        <div className="lg:col-span-4">
          <div className="sticky top-6">
            <div className="flex items-center gap-2 mb-4 px-1">
              <Smartphone className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Storefront Live Preview
              </span>
            </div>

            {/* Simulated Phone Frame */}
            <div className="w-full max-w-[340px] mx-auto rounded-[3rem] border-[12px] border-slate-900 overflow-hidden shadow-2xl bg-[#FAF9F4] relative aspect-[9/18]">
              {/* Camera Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-50 flex items-center justify-center">
                <div className="h-2 w-2 bg-slate-800 rounded-full" />
              </div>

              {/* Mock Homepage Background */}
              <div className="absolute inset-0 pt-10 px-4 flex flex-col justify-start opacity-30 select-none pointer-events-none">
                <div className="h-10 bg-slate-200 rounded-xl mb-4 w-2/3" />
                <div className="h-32 bg-slate-200 rounded-2xl mb-4" />
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-slate-200 rounded-lg" />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-40 bg-slate-200 rounded-2xl" />
                  <div className="h-40 bg-slate-200 rounded-2xl" />
                </div>
              </div>

              {/* Popup Modal Mockup */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-40 flex items-center justify-center p-5">
                {formData.imageUrl ? (
                  <div className="w-full bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 flex flex-col relative animate-in zoom-in-95 duration-300">
                    {/* Mock Close Button */}
                    <div className="absolute top-3 right-3 z-50 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </div>

                    {/* Image */}
                    <div className="w-full aspect-[4/5] bg-slate-100 overflow-hidden relative">
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="p-4 text-center">
                      <h4 className="text-xs font-black text-slate-800">
                        {formData.title || "Seasonal Sale"}
                      </h4>
                      {formData.description && (
                        <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
                          {formData.description}
                        </p>
                      )}
                      {formData.linkType !== "none" && (
                        <button className="w-full mt-3 py-2 bg-black hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors">
                          Shop Now
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-white rounded-3xl p-6 text-center border border-dashed border-slate-200 flex flex-col items-center justify-center">
                    <Eye className="h-6 w-6 text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-slate-400">
                      Select or upload an image to see live preview
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Popup Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPopup ? "Edit Popup Configuration" : "New Marketing Popup"}
      >
        <form onSubmit={handleSave} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Popup Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="E.g., Winter Clearance Sale"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Description / Subtitle
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Short call-to-action text (optional)"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none resize-none focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          {/* Image Upload/Link */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Popup Banner Image (Aspect Ratio ~4:5 recommended)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* File Upload Box */}
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                />
                <div className="h-28 border border-dashed border-slate-200 hover:border-slate-400 rounded-2xl bg-slate-50 flex flex-col items-center justify-center gap-1.5 transition-colors p-4 text-center">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-slate-500 animate-spin" />
                  ) : (
                    <>
                      <FileImage className="h-6 w-6 text-slate-400 group-hover:text-slate-600 transition-colors" />
                      <span className="text-[10px] font-black text-slate-500">Upload Image</span>
                      <span className="text-[9px] text-slate-400">Max size 10MB</span>
                    </>
                  )}
                </div>
              </div>

              {/* Direct Image URL input */}
              <div className="flex flex-col justify-between">
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="Or paste direct Image URL"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:font-normal"
                />
                {formData.imageUrl && (
                  <div className="mt-2 text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Image specified
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Redirection Link setup */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Redirection Type
              </label>
              <select
                value={formData.linkType}
                onChange={(e) => setFormData((prev) => ({ ...prev, linkType: e.target.value, linkValue: "" }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              >
                {LINK_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Target Link Value / Destination
              </label>
              {formData.linkType === "none" && (
                <input
                  disabled
                  value=""
                  placeholder="No redirection configured"
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-100 rounded-2xl text-xs font-bold outline-none cursor-not-allowed text-slate-400"
                />
              )}
              {formData.linkType === "header" && (
                <select
                  value={formData.linkValue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkValue: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                >
                  <option value="">Select Header Page</option>
                  {headers.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
              {formData.linkType === "category" && (
                <select
                  value={formData.linkValue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkValue: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {formData.linkType === "subcategory" && (
                <select
                  value={formData.linkValue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkValue: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                >
                  <option value="">Select Subcategory</option>
                  {subcategories.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              {formData.linkType === "product" && (
                <select
                  value={formData.linkValue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkValue: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none"
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {formData.linkType === "url" && (
                <input
                  type="text"
                  value={formData.linkValue}
                  onChange={(e) => setFormData((prev) => ({ ...prev, linkValue: e.target.value }))}
                  placeholder="Enter external destination URL (e.g. https://google.com)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:font-normal"
                />
              )}
            </div>
          </div>

          {/* Schedulers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Start Date (optional)
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> End Date (optional)
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          {/* Behavior Toggles */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-colors">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                  Active
                </span>
                <span className="text-[9px] text-slate-400">Status immediately toggled</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-colors">
              <input
                type="checkbox"
                checked={formData.showOnce}
                onChange={(e) => setFormData((prev) => ({ ...prev, showOnce: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-800 uppercase tracking-wide">
                  Show Once
                </span>
                <span className="text-[9px] text-slate-400">Only shown once per session</span>
              </div>
            </label>
          </div>

          {/* Submission buttons */}
          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="flex-1 py-4 bg-black hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "Saving..." : editingPopup ? "Save Changes" : "Create Popup"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
