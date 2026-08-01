import React, { useEffect, useState, useMemo } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import {
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
  Eye,
  AlertCircle,
  Upload,
  Search,
  CheckCircle,
  X,
  Grid,
  List,
  Star,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminApi } from "../services/adminApi";

export default function TodayBestPricesManagement() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState("all_products"); // "configured" | "all_products"

  // Filter Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Product Search State in Modal (if admin manually searches in modal)
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    productId: "",
    customImage: "",
    order: 0,
    status: "active",
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tbpRes, prodRes] = await Promise.all([
        adminApi.getTodayBestPricesAdmin().catch(() => ({ data: { items: [] } })),
        adminApi.getProducts({ limit: 200 }).catch(() => ({ data: { result: { items: [] } } })),
      ]);

      const tbpList = tbpRes.data?.result?.items || tbpRes.data?.results || tbpRes.data || [];
      const configured = Array.isArray(tbpList) ? tbpList : [];
      setItems(configured);

      const rawProds = prodRes.data?.result?.items || prodRes.data?.result || prodRes.data?.results || [];
      const catalog = Array.isArray(rawProds) ? rawProds : [];
      setCatalogProducts(catalog);

      // Default active tab to "all_products" if none configured, or "configured" if there are configured items
      if (configured.length > 0) {
        setActiveTab("configured");
      } else {
        setActiveTab("all_products");
      }
    } catch (error) {
      console.error("Failed to load Today's Best Prices configuration:", error);
      showToast("Failed to load products configuration", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map of configured product IDs for quick lookup
  const configuredMap = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const pId = String(item.product?._id || item.product?.id || item.product || "").trim();
      if (pId) map.set(pId, item);
    });
    return map;
  }, [items]);

  // Filter catalog products based on search query
  const filteredCatalogProducts = useMemo(() => {
    if (!searchQuery.trim()) return catalogProducts;
    const q = searchQuery.toLowerCase().trim();
    return catalogProducts.filter((p) =>
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.categoryName || p.categoryId?.name || "").toLowerCase().includes(q)
    );
  }, [catalogProducts, searchQuery]);

  // Modal manual search effect
  useEffect(() => {
    if (!productSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        setIsSearchingProducts(true);
        const res = await adminApi.getProducts({
          search: productSearchQuery,
          limit: 10,
        });
        const rawProducts = res.data?.result?.items || res.data?.result || res.data?.results || [];
        setSearchResults(Array.isArray(rawProducts) ? rawProducts : []);
      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [productSearchQuery]);

  const handleOpenAddModalForProduct = (product) => {
    setEditingItem(null);
    setSelectedProduct(product);
    setProductSearchQuery("");
    setSearchResults([]);
    setFormData({
      productId: product._id || product.id,
      customImage: "",
      order: items.length,
      status: "active",
    });
    setIsModalOpen(true);
  };

  const handleOpenAddModalGeneric = () => {
    setEditingItem(null);
    setSelectedProduct(null);
    setProductSearchQuery("");
    setSearchResults([]);
    setFormData({
      productId: "",
      customImage: "",
      order: items.length,
      status: "active",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setSelectedProduct(item.product);
    setProductSearchQuery("");
    setSearchResults([]);
    setFormData({
      productId: item.product?._id || item.product?.id || "",
      customImage: item.customImage || "",
      order: item.order || 0,
      status: item.status || "active",
    });
    setIsModalOpen(true);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setFormData((prev) => ({ ...prev, productId: product._id || product.id }));
    setSearchResults([]);
    setProductSearchQuery("");
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
      const res = await adminApi.uploadTodayBestPriceImage(formDataObj);
      const uploadedUrl = res.data?.result?.url || res.data?.url;
      if (uploadedUrl) {
        setFormData((prev) => ({ ...prev, customImage: uploadedUrl }));
        showToast("Custom image uploaded successfully", "success");
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
    if (!formData.productId) {
      showToast("Please select a product first", "warning");
      return;
    }

    try {
      setIsSaving(true);
      if (editingItem) {
        await adminApi.updateTodayBestPrice(editingItem._id, formData);
        showToast("Updated product mapping successfully", "success");
      } else {
        await adminApi.createTodayBestPrice(formData);
        showToast("Product added to Today's Best Prices!", "success");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Save failed:", error);
      showToast(error.response?.data?.message || "Failed to save mapping", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this product from Today's Best Prices?")) return;
    try {
      await adminApi.deleteTodayBestPrice(id);
      showToast("Removed product mapping successfully", "success");
      setItems((prev) => prev.filter((item) => item._id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
      showToast("Failed to remove product mapping", "error");
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const nextStatus = item.status === "active" ? "inactive" : "active";
      await adminApi.updateTodayBestPrice(item._id, { status: nextStatus });
      showToast(`Product ${nextStatus === "active" ? "activated" : "deactivated"} successfully`, "success");
      setItems((prev) =>
        prev.map((i) => (i._id === item._id ? { ...i, status: nextStatus } : i))
      );
    } catch (error) {
      console.error("Failed to update status:", error);
      showToast("Failed to update status", "error");
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const current = items[index];
    const prev = items[index - 1];

    try {
      setItems((prevItems) => {
        const next = [...prevItems];
        next[index] = prev;
        next[index - 1] = current;
        return next;
      });

      await Promise.all([
        adminApi.updateTodayBestPrice(current._id, { order: prev.order }),
        adminApi.updateTodayBestPrice(prev._id, { order: current.order }),
      ]);
    } catch (error) {
      console.error("Failed to reorder:", error);
      showToast("Failed to update ordering on server", "error");
      fetchData();
    }
  };

  const handleMoveDown = async (index) => {
    if (index === items.length - 1) return;
    const current = items[index];
    const nextItem = items[index + 1];

    try {
      setItems((prevItems) => {
        const next = [...prevItems];
        next[index] = nextItem;
        next[index + 1] = current;
        return next;
      });

      await Promise.all([
        adminApi.updateTodayBestPrice(current._id, { order: nextItem.order }),
        adminApi.updateTodayBestPrice(nextItem._id, { order: current.order }),
      ]);
    } catch (error) {
      console.error("Failed to reorder:", error);
      showToast("Failed to update ordering on server", "error");
      fetchData();
    }
  };

  // Quick feature all top catalog products with 1 click
  const handleQuickAddTopProducts = async () => {
    if (catalogProducts.length === 0) return;
    const topToFeature = catalogProducts.slice(0, 8);
    try {
      setIsSaving(true);
      let addedCount = 0;
      for (let i = 0; i < topToFeature.length; i++) {
        const p = topToFeature[i];
        const pId = p._id || p.id;
        if (!configuredMap.has(String(pId))) {
          await adminApi.createTodayBestPrice({
            productId: pId,
            customImage: "",
            order: items.length + i,
            status: "active",
          }).catch(() => null);
          addedCount++;
        }
      }
      showToast(`Added ${addedCount} products to Today's Best Prices!`, "success");
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 px-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 mb-8">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Today's Best Prices
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
          </h1>
          <p className="ds-description mt-1">
            Choose products to show on the user homepage "Today's Best Prices" section and upload custom display images.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {items.length === 0 && catalogProducts.length > 0 && (
            <button
              onClick={handleQuickAddTopProducts}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
            >
              <Star className="h-4 w-4" />
              Quick Feature Top 8
            </button>
          )}
          <button
            onClick={handleOpenAddModalGeneric}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Custom Entry
          </button>
        </div>
      </div>

      {/* Tabs and Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("all_products")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all select-none",
              activeTab === "all_products"
                ? "bg-white text-slate-900 shadow-md"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Grid className="h-4 w-4" />
            Choose From Store Products ({catalogProducts.length})
          </button>
          <button
            onClick={() => setActiveTab("configured")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all select-none",
              activeTab === "configured"
                ? "bg-white text-slate-900 shadow-md"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Layers className="h-4 w-4" />
            Active Carousel Products ({items.length})
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:font-normal"
          />
        </div>
      </div>

      {isLoading ? (
        <Card className="border-none shadow-xl bg-white rounded-2xl overflow-hidden p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: ALL STORE PRODUCTS VIEW (CHOOSE PRODUCTS) */}
          {activeTab === "all_products" && (
            <div>
              {filteredCatalogProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredCatalogProducts.map((product) => {
                    const pId = String(product._id || product.id);
                    const existing = configuredMap.get(pId);
                    const mainImg = product.mainImage || product.image;

                    return (
                      <Card
                        key={pId}
                        className={cn(
                          "border border-slate-100 shadow-sm hover:shadow-md transition-all rounded-2xl p-4 flex flex-col justify-between relative bg-white overflow-hidden group",
                          existing && "ring-2 ring-emerald-500/20 bg-emerald-50/10 border-emerald-100"
                        )}
                      >
                        <div>
                          {/* Image preview & badge */}
                          <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-slate-50 border border-slate-100">
                            <img
                              src={
                                existing?.customImage ||
                                mainImg ||
                                "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=300&h=300"
                              }
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {existing ? (
                              <div className="absolute top-2 right-2">
                                <Badge variant="success" className="font-black text-[9px] uppercase shadow-md px-2 py-0.5">
                                  Configured
                                </Badge>
                              </div>
                            ) : null}
                          </div>

                          {/* Details */}
                          <h3 className="text-xs font-black text-slate-800 line-clamp-2 leading-tight mb-1">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-black text-slate-900">
                              ₹{product.salePrice || product.price}
                            </span>
                            {product.salePrice && product.salePrice < product.price ? (
                              <span className="text-[10px] text-slate-400 line-through">
                                ₹{product.price}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Action Button */}
                        <div>
                          {existing ? (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => handleOpenEditModal(existing)}
                                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Edit Pic / Order
                              </button>
                              <button
                                onClick={() => handleDelete(existing._id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                title="Remove mapping"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenAddModalForProduct(product)}
                              className="w-full py-2.5 px-3 bg-black hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Select For Today's Prices
                            </button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm flex flex-col items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm font-black text-slate-700">No products match your search</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Try searching with another keyword or clear the search filter above.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE CAROUSEL PRODUCTS VIEW */}
          {activeTab === "configured" && (
            <div>
              {items.length > 0 ? (
                <Card className="border-none shadow-md bg-white rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Order
                          </th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Product Details
                          </th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Custom Section Picture
                          </th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Price Settings
                          </th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                            Status
                          </th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => {
                          const product = item.product || {};
                          const mainImg = product.mainImage || product.image;
                          return (
                            <tr
                              key={item._id}
                              className="hover:bg-slate-50/50 transition-colors group"
                            >
                              {/* Order control */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                                    #{idx + 1}
                                  </span>
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => handleMoveUp(idx)}
                                      disabled={idx === 0}
                                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveDown(idx)}
                                      disabled={idx === items.length - 1}
                                      className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Product details */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={mainImg || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=200&h=200"}
                                    alt={product.name || "Product"}
                                    className="h-10 w-10 rounded-xl object-cover border border-slate-100 bg-slate-50 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-800 truncate max-w-[220px]">
                                      {product.name || "Deleted Product"}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                      ID: {product._id || "N/A"}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Custom Display Image */}
                              <td className="px-6 py-4">
                                {item.customImage ? (
                                  <div className="flex items-center gap-2.5">
                                    <img
                                      src={item.customImage}
                                      alt="Custom"
                                      className="h-10 w-10 rounded-xl object-cover border border-emerald-100 bg-emerald-50 shrink-0"
                                    />
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                      Custom Overridden
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2.5 text-slate-400">
                                    <img
                                      src={mainImg || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=200&h=200"}
                                      alt="Fallback"
                                      className="h-10 w-10 rounded-xl object-cover border border-slate-100 opacity-60 bg-slate-50 shrink-0"
                                    />
                                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                      Default Product Pic
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Price */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-xs font-bold text-slate-800">
                                  MRP: ₹{product.price || 0}
                                </div>
                                {product.salePrice && product.salePrice < product.price ? (
                                  <div className="text-[10px] font-black text-emerald-600">
                                    Sale: ₹{product.salePrice}
                                  </div>
                                ) : null}
                              </td>

                              {/* Status */}
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <button
                                  onClick={() => handleToggleStatus(item)}
                                  className="inline-block transition-transform active:scale-95"
                                >
                                  <Badge
                                    variant={item.status === "active" ? "success" : "secondary"}
                                    className="cursor-pointer font-black select-none tracking-widest text-[9px] uppercase px-3 py-1"
                                  >
                                    {item.status === "active" ? "Active" : "Inactive"}
                                  </Badge>
                                </button>
                              </td>

                              {/* Actions */}
                              <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenEditModal(item)}
                                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                                    title="Edit mapping settings"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item._id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                    title="Remove from list"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm flex flex-col items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm font-black text-slate-700">No products configured yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Switch to the "Choose From Store Products" tab above or click below to select products for the homepage carousel.
                  </p>
                  <button
                    onClick={() => setActiveTab("all_products")}
                    className="mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-800"
                  >
                    <Grid className="h-4 w-4" />
                    Browse Store Products
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Today's Best Price Entry" : "Add Product to Today's Best Prices"}
      >
        <form onSubmit={handleSave} className="space-y-5">
          {/* Product Selection */}
          {!editingItem ? (
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Search & Select Product
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Type product name (e.g., face wash)"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:font-normal"
                />
              </div>

              {/* Product dropdown list */}
              {isSearchingProducts && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}

              {!isSearchingProducts && searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-[220px] overflow-y-auto divide-y divide-slate-50">
                  {searchResults.map((p) => (
                    <div
                      key={p._id}
                      onClick={() => handleSelectProduct(p)}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <img
                        src={p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=100&h=100"}
                        alt={p.name}
                        className="h-8 w-8 rounded-lg object-cover border"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400">MRP: ₹{p.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* If product is selected, show selected badge details */}
          {selectedProduct && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
              <img
                src={selectedProduct.mainImage || selectedProduct.image}
                alt={selectedProduct.name}
                className="h-10 w-10 rounded-xl object-cover border shrink-0 bg-white"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Selected Product</p>
                <p className="text-xs font-bold text-emerald-700 truncate">{selectedProduct.name}</p>
                <p className="text-[10px] text-emerald-600">MRP: ₹{selectedProduct.price}</p>
              </div>
              {!editingItem && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setFormData((prev) => ({ ...prev, productId: "" }));
                  }}
                  className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Custom Display Image Upload */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Custom Display Image (Optional - Overrides Main Photo)
            </label>
            <div className="flex flex-col gap-3">
              {formData.customImage ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 group">
                  <img
                    src={formData.customImage}
                    alt="Custom Uploaded"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, customImage: "" }))}
                    className="absolute top-3 right-3 p-2 bg-black/60 text-white hover:bg-black rounded-xl transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="w-full aspect-video flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50/50 hover:border-slate-300 transition-all select-none">
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-6 w-6 text-slate-400 animate-spin mb-2" />
                      <p className="text-xs font-bold text-slate-400">Uploading Image...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="p-3 bg-slate-100 rounded-xl mb-3 text-slate-500">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-black text-slate-700">Click to upload custom section picture</p>
                      <p className="text-[10px] text-slate-400 mt-1">PNG, JPG or WEBP up to 10MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Row for Order & Status */}
          <div className="grid grid-cols-2 gap-4">
            {/* Display Order */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Sort Order
              </label>
              <input
                type="number"
                required
                min={0}
                value={formData.order}
                onChange={(e) => setFormData((prev) => ({ ...prev, order: Number(e.target.value) }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="px-6 py-3 bg-black text-white hover:bg-slate-800 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {editingItem ? "Save Changes" : "Select Product"}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
