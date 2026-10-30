import React, { useEffect, useState, useMemo } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import { useToast } from "@shared/components/ui/Toast";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
  Search,
  CheckCircle,
  Grid,
  List,
  ShoppingCart,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminApi } from "../services/adminApi";

export default function CheckoutRecommendationsManagement() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("configured"); // "configured" | "all_products"
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [recRes, prodRes] = await Promise.all([
        adminApi.getCheckoutRecommendationsAdmin().catch(() => ({ data: { items: [] } })),
        adminApi.getProducts({ limit: 300, sellerId: "admin" }).catch(() => ({ data: { result: { items: [] } } })),
      ]);

      const recList = recRes.data?.result?.items || recRes.data?.results || recRes.data || [];
      const configured = Array.isArray(recList) ? recList : [];
      setItems(configured);

      const rawProds = prodRes.data?.result?.items || prodRes.data?.result || prodRes.data?.results || [];
      const catalog = Array.isArray(rawProds) ? rawProds : [];
      const adminOnlyCatalog = catalog.filter((p) => !p.sellerId || p.sellerId === "admin");
      setCatalogProducts(adminOnlyCatalog);

      if (configured.length === 0) {
        setActiveTab("all_products");
      }
    } catch (error) {
      console.error("Failed to load checkout recommendations:", error);
      showToast("Failed to load checkout recommendations configuration", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Set of configured product IDs for quick lookup
  const configuredMap = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const pId = String(item.product?._id || item.product?.id || item.product || "").trim();
      if (pId) map.set(pId, item);
    });
    return map;
  }, [items]);

  // Filter configured items by search query
  const filteredConfiguredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const name = item.product?.name || "";
      return name.toLowerCase().includes(query);
    });
  }, [items, searchQuery]);

  // Filter catalog products by search query
  const filteredCatalogProducts = useMemo(() => {
    if (!searchQuery.trim()) return catalogProducts;
    const query = searchQuery.toLowerCase().trim();
    return catalogProducts.filter((p) => {
      const name = p.name || p.displayName || "";
      return name.toLowerCase().includes(query);
    });
  }, [catalogProducts, searchQuery]);

  const handleQuickAdd = async (product) => {
    const pId = product._id || product.id;
    if (configuredMap.has(String(pId))) {
      showToast("This product is already added", "info");
      return;
    }

    try {
      setActionLoadingId(String(pId));
      const res = await adminApi.createCheckoutRecommendation({
        productId: pId,
        order: items.length,
        status: "active",
      });

      const newItem = res.data?.result || res.data;
      if (newItem) {
        setItems((prev) => [...prev, newItem]);
        showToast(`Added ${product.name} to Checkout Recommendations!`, "success");
      } else {
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to add product:", error);
      showToast(error.response?.data?.message || "Failed to add product", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemove = async (itemId) => {
    if (!window.confirm("Remove this product from Checkout Recommendations?")) return;
    try {
      setActionLoadingId(String(itemId));
      await adminApi.deleteCheckoutRecommendation(itemId);
      setItems((prev) => prev.filter((i) => i._id !== itemId));
      showToast("Removed product from Checkout Recommendations", "success");
    } catch (error) {
      console.error("Failed to remove product:", error);
      showToast("Failed to remove product", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMoveOrder = async (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Update orders
    const updated = newItems.map((item, idx) => ({ ...item, order: idx }));
    setItems(updated);

    try {
      await Promise.all([
        adminApi.updateCheckoutRecommendation(newItems[index]._id, { order: index }),
        adminApi.updateCheckoutRecommendation(newItems[targetIndex]._id, { order: targetIndex }),
      ]);
    } catch (error) {
      console.error("Failed to update item order", error);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Checkout Recommendations
                <Badge variant="primary" className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 border-none font-bold">
                  You Might Also Like
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Select products to be featured in the <b>&quot;You might also like&quot;</b> section on the customer checkout page (<code className="text-xs text-amber-700 bg-amber-50 px-1 py-0.5 rounded">/checkout</code>).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab(activeTab === "configured" ? "all_products" : "configured")}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
          >
            {activeTab === "configured" ? (
              <>
                <Plus className="w-4 h-4" />
                Add From Products Catalog
              </>
            ) : (
              <>
                <List className="w-4 h-4" />
                View Configured Products ({items.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-amber-50/80 via-amber-50/40 to-slate-50 border border-amber-200/60 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs">
        <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-slate-700 leading-relaxed">
          <p className="font-bold text-slate-900">How Checkout Recommendations Work</p>
          <p className="text-slate-600 mt-0.5">
            Products configured here will automatically be recommended to customers right below their cart items on the checkout page. If no products are configured, the checkout automatically falls back to relevant category items.
          </p>
        </div>
      </div>

      {/* Main Tabs and Search Filter */}
      <Card className="p-4 sm:p-5 border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("configured")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                activeTab === "configured"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <List className="w-3.5 h-3.5" />
              In Checkout ({items.length})
            </button>
            <button
              onClick={() => setActiveTab("all_products")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                activeTab === "all_products"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Grid className="w-3.5 h-3.5" />
              Choose From Store Products ({catalogProducts.length})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content View */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            <p className="text-xs font-semibold">Loading checkout recommendations...</p>
          </div>
        ) : activeTab === "configured" ? (
          /* TAB 1: Configured Items List */
          <div>
            {filteredConfiguredItems.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No products configured for checkout</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Add products from your store catalog to feature them in the &quot;You might also like&quot; checkout strip.
                </p>
                <button
                  onClick={() => setActiveTab("all_products")}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-amber-500/20"
                >
                  Browse Store Products
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredConfiguredItems.map((item, index) => {
                  const product = item.product || {};
                  const isActionBusy = actionLoadingId === String(item._id);
                  const displayImage = product.mainImage || product.image;

                  return (
                    <div
                      key={item._id}
                      className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-white border border-slate-200/80 rounded-2xl hover:border-slate-300 hover:shadow-xs transition-all group"
                    >
                      {/* Left info */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        {/* Order pill */}
                        <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xs shrink-0">
                          #{index + 1}
                        </div>

                        {/* Image */}
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {displayImage ? (
                            <img src={displayImage} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        {/* Product details */}
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-amber-600 transition-colors">
                            {product.name || "Untitled Product"}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-black text-slate-900">
                              ₹{product.salePrice || product.price || 0}
                            </span>
                            {product.salePrice && product.price && product.salePrice < product.price && (
                              <span className="text-[10px] text-slate-400 line-through">
                                ₹{product.price}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              • Stock: {product.stock ?? "N/A"}
                            </span>
                            <Badge variant="success" className="text-[9px] py-0 px-1.5 bg-emerald-50 text-emerald-700 border-none font-bold">
                              Active in Checkout
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        {/* Reorder Up */}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveOrder(index, "up")}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Reorder Down */}
                        <button
                          type="button"
                          disabled={index === items.length - 1}
                          onClick={() => handleMoveOrder(index, "down")}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          disabled={isActionBusy}
                          onClick={() => handleRemove(item._id)}
                          className="p-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 transition-all disabled:opacity-50"
                          title="Remove from checkout"
                        >
                          {isActionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: All Store Products Catalog Grid */
          <div>
            {filteredCatalogProducts.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No products found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search query to find products.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {filteredCatalogProducts.map((product) => {
                  const pId = String(product._id || product.id);
                  const isAlreadyAdded = configuredMap.has(pId);
                  const isActionBusy = actionLoadingId === pId;
                  const displayImage = product.mainImage || product.image;

                  return (
                    <div
                      key={pId}
                      className={cn(
                        "flex flex-col justify-between p-3 rounded-2xl border transition-all relative overflow-hidden bg-white",
                        isAlreadyAdded
                          ? "border-amber-300 bg-amber-50/20 ring-1 ring-amber-300/40"
                          : "border-slate-200/80 hover:border-slate-300 hover:shadow-sm"
                      )}
                    >
                      {isAlreadyAdded && (
                        <div className="absolute top-2 right-2 z-10">
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Added
                          </span>
                        </div>
                      )}

                      <div>
                        {/* Image */}
                        <div className="w-full aspect-square rounded-xl bg-slate-50 border border-slate-100 overflow-hidden mb-2.5 flex items-center justify-center relative">
                          {displayImage ? (
                            <img src={displayImage} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-8 h-8 text-slate-300" />
                          )}
                        </div>

                        {/* Title & Price */}
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight mb-1">
                          {product.name}
                        </h4>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-black text-slate-900">
                            ₹{product.salePrice || product.price || 0}
                          </span>
                          {product.salePrice && product.price && product.salePrice < product.price && (
                            <span className="text-[10px] text-slate-400 line-through">
                              ₹{product.price}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add button */}
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        {isAlreadyAdded ? (
                          <button
                            type="button"
                            onClick={() => {
                              const item = configuredMap.get(pId);
                              if (item?._id) handleRemove(item._id);
                            }}
                            className="w-full py-1.5 px-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isActionBusy}
                            onClick={() => handleQuickAdd(product)}
                            className="w-full py-1.5 px-2 bg-slate-900 hover:bg-amber-600 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                          >
                            {isActionBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add to Checkout
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

