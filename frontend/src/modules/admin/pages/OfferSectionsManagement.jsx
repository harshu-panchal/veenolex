import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import {
  HiOutlinePlus,
  HiOutlinePhoto,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineArrowUpCircle,
  HiOutlineArrowDownCircle,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
  HiOutlineTag,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineSparkles,
  HiOutlineArrowTopRightOnSquare,
} from "react-icons/hi2";
import { cn } from "@/lib/utils";
import { adminApi } from "../services/adminApi";
import {
  BACKGROUND_COLOR_OPTIONS,
  SIDE_IMAGE_OPTIONS,
} from "@/shared/constants/offerSectionOptions";

const OfferSectionsManagement = () => {
  const { showToast } = useToast();
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productsFiltered, setProductsFiltered] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    backgroundColor: "#FCD34D",
    sideImageKey: "hair-care",
    categoryIds: [],
    order: 0,
    status: "active",
    isAutomatic: false,
  });

  const [comingSoonConfig, setComingSoonConfig] = useState({
    enabled: true,
    title: "Coming Soon",
    subtitle: "Exclusive preview of upcoming arrivals",
    backgroundColor: "#C084FC",
    sideImageKey: "beauty",
  });
  const [comingSoonProducts, setComingSoonProducts] = useState([]);
  const [isSavingComingSoon, setIsSavingComingSoon] = useState(false);
  const [isAddCsModalOpen, setIsAddCsModalOpen] = useState(false);
  const [csProductSearch, setCsProductSearch] = useState("");
  const [allAdminProductsForCs, setAllAdminProductsForCs] = useState([]);
  const [isLoadingCsModalProds, setIsLoadingCsModalProds] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await adminApi.getCategories();
      const list = res.data.results || res.data.result || [];
      const cats = (Array.isArray(list) ? list : []).filter(
        (c) => c.type === "category"
      );
      setCategories(cats);
    } catch (e) {
      console.error(e);
      showToast("Failed to load categories", "error");
    }
  };

  const loadAdminProducts = async ({ categoryId = selectedCategoryFilter, search = productSearch } = {}) => {
    try {
      setIsProductsLoading(true);
      const params = { limit: 300, sellerId: "admin" };
      if (categoryId && categoryId !== "all") {
        params.categoryIds = categoryId;
      }
      if (search && search.trim()) {
        params.search = search.trim();
      }
      const res = await adminApi.getProducts(params);
      const raw = res.data.result;
      const list = Array.isArray(res.data.results)
        ? res.data.results
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw)
            ? raw
            : [];
      // Ensure only admin master catalog products (sellerId is null/undefined or "admin")
      const adminOnly = list.filter((p) => !p.sellerId || p.sellerId === "admin");
      setProductsFiltered(adminOnly);
    } catch (e) {
      console.error(e);
      setProductsFiltered([]);
      showToast("Failed to load admin products", "error");
    } finally {
      setIsProductsLoading(false);
    }
  };

  const loadSections = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getOfferSections();
      const list = res.data.results || res.data.result || res.data;
      setSections(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load offer sections", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadComingSoonData = async () => {
    try {
      const res = await adminApi.getSettings();
      const settings = res.data.results || res.data.result || res.data;
      if (settings?.comingSoonSection) {
        setComingSoonConfig((prev) => ({ ...prev, ...settings.comingSoonSection }));
      }
    } catch (err) {
      console.error("Failed to load coming soon settings", err);
    }
    try {
      const pRes = await adminApi.getProducts({ limit: 100, status: "coming_soon", sellerId: "admin" });
      const raw = pRes.data.result;
      const list = Array.isArray(pRes.data.results)
        ? pRes.data.results
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw)
        ? raw
        : [];
      setComingSoonProducts(list.filter((p) => p.status === "coming_soon"));
    } catch (err) {
      console.error("Failed to load coming soon products", err);
    }
  };

  const handleToggleComingSoon = async (enabled) => {
    const updated = { ...comingSoonConfig, enabled };
    setComingSoonConfig(updated);
    try {
      await adminApi.updateSettings({ comingSoonSection: updated });
      showToast(`Coming Soon section ${enabled ? "enabled" : "disabled"}`, "success");
    } catch (err) {
      setComingSoonConfig((prev) => ({ ...prev, enabled: !enabled }));
      showToast("Failed to update Coming Soon section toggle", "error");
    }
  };

  const handleSaveComingSoonConfig = async (e) => {
    if (e) e.preventDefault();
    setIsSavingComingSoon(true);
    try {
      await adminApi.updateSettings({ comingSoonSection: comingSoonConfig });
      showToast("Coming Soon section settings saved", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to save Coming Soon settings", "error");
    } finally {
      setIsSavingComingSoon(false);
    }
  };

  const handleSetProductComingSoon = async (product, makeComingSoon) => {
    try {
      const newStatus = makeComingSoon ? "coming_soon" : "active";
      const fd = new FormData();
      fd.append("status", newStatus);
      await adminApi.updateProduct(product._id, fd);
      showToast(
        makeComingSoon
          ? `"${product.name}" marked as Coming Soon`
          : `"${product.name}" moved to Active products`,
        "success"
      );
      await loadComingSoonData();
    } catch (err) {
      console.error(err);
      showToast("Failed to update product status", "error");
    }
  };

  const openCsProductModal = async () => {
    setIsAddCsModalOpen(true);
    setIsLoadingCsModalProds(true);
    try {
      const res = await adminApi.getProducts({ limit: 300, sellerId: "admin" });
      const raw = res.data.result;
      const list = Array.isArray(res.data.results)
        ? res.data.results
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw)
        ? raw
        : [];
      setAllAdminProductsForCs(list.filter((p) => !p.sellerId || p.sellerId === "admin"));
    } catch (err) {
      console.error(err);
      showToast("Failed to load products", "error");
    } finally {
      setIsLoadingCsModalProds(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadSections();
    loadComingSoonData();
  }, []);

  const categoryMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c._id] = c));
    return m;
  }, [categories]);

  const isSectionTwoOffer = useMemo(() => {
    if (!editingSection) return false;
    const idx = sections.findIndex((s) => String(s._id) === String(editingSection._id));
    const title = (editingSection.title || "").trim().toLowerCase();

    // Matches section #2 (index 1), order 1, or title matching 'offer' while NOT #1 or 'top selling'
    const isSecond = idx === 1 || editingSection.order === 1;
    const isOfferTitle = title === "offer" || title.includes("offer");
    const isTopSelling = idx === 0 || title.includes("top selling");

    return (isSecond || isOfferTitle) && !isTopSelling;
  }, [editingSection, sections]);

  const resetForm = () => {
    setFormData({
      title: "",
      backgroundColor: "#FCD34D",
      sideImageKey: "hair-care",
      categoryIds: [],
      order: sections.length,
      status: "active",
      isAutomatic: false,
    });
    setSelectedProducts([]);
    setEditingSection(null);
  };

  const openCreateModal = () => {
    resetForm();
    setProductSearch("");
    setSelectedCategoryFilter("");
    setIsModalOpen(true);
    loadAdminProducts({ categoryId: "", search: "" });
  };

  const openEditModal = (section) => {
    setEditingSection(section);
    const catIds = (section.categoryIds || []).map((c) => (typeof c === "object" && c?._id ? c._id : c)).filter(Boolean);
    if (!catIds.length && (section.categoryId?._id || section.categoryId)) {
      catIds.push(section.categoryId?._id || section.categoryId);
    }

    // Populate selected products with offer prices
    let initialSelected = [];
    if (Array.isArray(section.productDetails) && section.productDetails.length > 0) {
      initialSelected = section.productDetails.map((d) => {
        const prod = d.productId;
        if (typeof prod === "object" && prod !== null) {
          const regularPrice = Number(prod.price || 0);
          const salePrice = Number(prod.salePrice || 0);
          const offerPrice = Number(d.offerPrice) > 0 ? Number(d.offerPrice) : (salePrice > 0 ? salePrice : regularPrice);
          return {
            _id: String(prod._id),
            productId: String(prod._id),
            name: prod.name,
            image: prod.mainImage || prod.image || "",
            price: regularPrice,
            salePrice: salePrice,
            offerPrice: offerPrice,
          };
        }
        return {
          _id: String(prod),
          productId: String(prod),
          name: "Admin Product",
          image: "",
          price: 0,
          salePrice: 0,
          offerPrice: Number(d.offerPrice) || 0,
        };
      });
    } else if (Array.isArray(section.productIds) && section.productIds.length > 0) {
      initialSelected = section.productIds.map((p) => {
        if (typeof p === "object" && p !== null) {
          const regularPrice = Number(p.price || 0);
          const salePrice = Number(p.salePrice || 0);
          const offerPrice = Number(p.offerPrice) > 0 ? Number(p.offerPrice) : (salePrice > 0 ? salePrice : regularPrice);
          return {
            _id: String(p._id),
            productId: String(p._id),
            name: p.name,
            image: p.mainImage || p.image || "",
            price: regularPrice,
            salePrice: salePrice,
            offerPrice: offerPrice,
          };
        }
        return {
          _id: String(p),
          productId: String(p),
          name: "Admin Product",
          image: "",
          price: 0,
          salePrice: 0,
          offerPrice: 0,
        };
      });
    }

    const idx = sections.findIndex((s) => String(s._id) === String(section._id));
    const title = (section.title || "").trim().toLowerCase();
    const isSecondOffer = (idx === 1 || section.order === 1 || title === "offer" || title.includes("offer")) && !(idx === 0 || title.includes("top selling"));

    setFormData({
      title: section.title || "",
      backgroundColor: section.backgroundColor || "#FCD34D",
      sideImageKey: section.sideImageKey || "hair-care",
      categoryIds: catIds,
      order: section.order ?? 0,
      status: section.status || "active",
      isAutomatic: isSecondOffer ? false : Boolean(section.isAutomatic),
    });
    setSelectedProducts(initialSelected);
    setProductSearch("");
    setSelectedCategoryFilter("");
    setIsModalOpen(true);
    loadAdminProducts({ categoryId: "", search: "" });
  };

  const handleAddProduct = (product) => {
    const pId = String(product._id);
    if (selectedProducts.some((p) => String(p._id || p.productId) === pId)) {
      return;
    }
    const defPrice = Number(product.price || 0);
    const defSalePrice = Number(product.salePrice || 0);
    const initialOfferPrice = defSalePrice > 0 ? defSalePrice : defPrice;

    setSelectedProducts((prev) => [
      ...prev,
      {
        _id: pId,
        productId: pId,
        name: product.name,
        image: product.mainImage || product.image || "",
        price: defPrice,
        salePrice: defSalePrice,
        offerPrice: initialOfferPrice,
      },
    ]);
  };

  const handleRemoveProduct = (pId) => {
    setSelectedProducts((prev) =>
      prev.filter((p) => String(p._id || p.productId) !== String(pId))
    );
  };

  const handleUpdateOfferPrice = (pId, newPrice) => {
    setSelectedProducts((prev) =>
      prev.map((p) => {
        if (String(p._id || p.productId) === String(pId)) {
          return { ...p, offerPrice: newPrice };
        }
        return p;
      })
    );
  };

  const handleSelectAllFiltered = () => {
    const existingIds = new Set(selectedProducts.map((p) => String(p._id || p.productId)));
    const newItems = productsFiltered
      .filter((p) => !existingIds.has(String(p._id)))
      .map((p) => {
        const defPrice = Number(p.price || 0);
        const defSalePrice = Number(p.salePrice || 0);
        return {
          _id: String(p._id),
          productId: String(p._id),
          name: p.name,
          image: p.mainImage || p.image || "",
          price: defPrice,
          salePrice: defSalePrice,
          offerPrice: defSalePrice > 0 ? defSalePrice : defPrice,
        };
      });
    setSelectedProducts((prev) => [...prev, ...newItems]);
  };

  const handleClearAllSelected = () => {
    setSelectedProducts([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Section title is required", "warning");
      return;
    }
    const isAuto = isSectionTwoOffer ? false : Boolean(formData.isAutomatic);
    if (!isAuto && selectedProducts.length === 0) {
      showToast("Please add at least one product with offer price or switch to Automatic mode", "warning");
      return;
    }

    const productDetails = isAuto
      ? []
      : selectedProducts.map((p) => ({
          productId: p.productId || p._id,
          offerPrice: Math.max(0, Number(p.offerPrice) || 0),
        }));
    const productIds = productDetails.map((p) => p.productId);

    const payload = {
      title: formData.title.trim(),
      backgroundColor: formData.backgroundColor,
      sideImageKey: formData.sideImageKey,
      categoryIds: isAuto ? [] : (formData.categoryIds || []),
      sellerIds: [],
      productIds: productIds,
      productDetails: productDetails,
      order: Number(formData.order) || 0,
      status: formData.status,
      isAutomatic: isAuto,
    };

    try {
      if (editingSection) {
        await adminApi.updateOfferSection(editingSection._id, payload);
        showToast("Offer section updated", "success");
      } else {
        await adminApi.createOfferSection(payload);
        showToast("Offer section created", "success");
      }
      setIsModalOpen(false);
      await loadSections();
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message || "Failed to save section",
        "error"
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this offer section?")) return;
    try {
      await adminApi.deleteOfferSection(id);
      setSections((prev) => prev.filter((s) => s._id !== id));
      showToast("Section deleted", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete section", "error");
    }
  };

  const handleReorder = async (direction, section) => {
    const idx = sections.findIndex((s) => s._id === section._id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const copy = [...sections];
    const [removed] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, removed);
    const items = copy.map((s, i) => ({ id: s._id, order: i }));
    try {
      await adminApi.reorderOfferSections(items);
      setSections(copy.map((s, i) => ({ ...s, order: i })));
    } catch (e) {
      console.error(e);
      showToast("Failed to reorder", "error");
    }
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1 mb-6">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Offer Sections
            <Badge
              variant="primary"
              className="text-[10px] font-black uppercase tracking-widest"
            >
              Admin Products · Offer Price
            </Badge>
          </h1>
          <p className="ds-description mt-1">
            Curate offer sections with admin products and special offer prices. Choose banner colour and side image per section.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
        >
          <HiOutlinePlus className="h-5 w-5" />
          New Section
        </button>
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Sections ({sections.length})
          </h2>
          {isLoading && (
            <span className="text-[10px] font-bold text-slate-400">
              Loading...
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {sections.map((section, idx) => {
            const sideOpt = SIDE_IMAGE_OPTIONS.find(
              (o) => o.key === section.sideImageKey
            );
            const productCount = (section.productDetails?.length || section.productIds?.length || 0);

            return (
              <div
                key={section._id}
                className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/40 transition-colors"
              >
                <div className="flex items-center gap-3 md:min-w-[220px]">
                  <div
                    className="h-14 w-14 rounded-2xl flex-shrink-0 bg-cover bg-center ring-2 ring-slate-100"
                    style={{
                      backgroundColor: section.backgroundColor || "#FCD34D",
                      backgroundImage: sideOpt?.imageUrl
                        ? `url(${sideOpt.imageUrl})`
                        : undefined,
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-900">
                        #{idx + 1} {section.title}
                      </p>
                      {section.isAutomatic ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[9px] font-black uppercase tracking-wider">
                          Automatic
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                          Manual ({productCount})
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                      {section.isAutomatic
                        ? "Dynamic · Top Selling Products"
                        : `Admin Products · ${productCount} item(s) on offer`}
                    </p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span
                    className="inline-block w-6 h-6 rounded-full border border-slate-200"
                    style={{
                      backgroundColor: section.backgroundColor || "#FCD34D",
                    }}
                    title={section.backgroundColor}
                  />
                  <span className="text-[10px] font-bold text-slate-500">
                    {section.sideImageKey || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleReorder("up", section)}
                      className={cn(
                        "p-1.5 rounded-xl border text-slate-400 hover:text-slate-700 hover:bg-slate-50",
                        idx === 0 && "opacity-30 cursor-not-allowed"
                      )}
                    >
                      <HiOutlineArrowUpCircle className="h-4 w-4" />
                    </button>
                    <button
                      disabled={idx === sections.length - 1}
                      onClick={() => handleReorder("down", section)}
                      className={cn(
                        "p-1.5 rounded-xl border text-slate-400 hover:text-slate-700 hover:bg-slate-50",
                        idx === sections.length - 1 &&
                        "opacity-30 cursor-not-allowed"
                      )}
                    >
                      <HiOutlineArrowDownCircle className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => openEditModal(section)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl"
                  >
                    <HiOutlinePencilSquare className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(section._id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                  >
                    <HiOutlineTrash className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
          {sections.length === 0 && !isLoading && (
            <div className="p-16 text-center">
              <HiOutlinePhoto className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-900">
                No offer sections yet
              </h3>
              <p className="text-sm font-bold text-slate-400 mt-2">
                Click &quot;New Section&quot; to pick admin products, set their offer prices, and publish them to the home page.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Coming Soon Section Settings & Products Card */}
      <Card className="p-6 md:p-8 space-y-6 border border-slate-100 rounded-3xl shadow-sm bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
              <HiOutlineClock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Coming Soon Section
                </h3>
                <Badge
                  variant={comingSoonConfig.enabled ? "purple" : "outline"}
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5"
                >
                  {comingSoonConfig.enabled ? "Visible on storefront" : "Hidden"}
                </Badge>
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Displays below the Offer Section on customer homepage with unreleased items.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <span className="text-xs font-bold text-slate-700">
                {comingSoonConfig.enabled ? "Section ON" : "Section OFF"}
              </span>
              <input
                type="checkbox"
                checked={comingSoonConfig.enabled}
                onChange={(e) => handleToggleComingSoon(e.target.checked)}
                className="sr-only"
              />
              <div
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative cursor-pointer",
                  comingSoonConfig.enabled ? "bg-purple-600" : "bg-slate-200"
                )}
                onClick={() => handleToggleComingSoon(!comingSoonConfig.enabled)}
              >
                <div
                  className={cn(
                    "w-5 h-5 bg-white rounded-full absolute top-0.75 transition-transform shadow-sm",
                    comingSoonConfig.enabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </div>
            </label>
          </div>
        </div>

        {/* Section Appearance Customizer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Banner Title
            </label>
            <input
              type="text"
              value={comingSoonConfig.title || ""}
              onChange={(e) =>
                setComingSoonConfig((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Coming Soon"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Banner Subtitle
            </label>
            <input
              type="text"
              value={comingSoonConfig.subtitle || ""}
              onChange={(e) =>
                setComingSoonConfig((prev) => ({ ...prev, subtitle: e.target.value }))
              }
              placeholder="Exclusive preview of upcoming arrivals"
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Banner Background Color
            </label>
            <div className="flex flex-wrap gap-2">
              {BACKGROUND_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setComingSoonConfig((prev) => ({
                      ...prev,
                      backgroundColor: opt.value,
                    }))
                  }
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all",
                    comingSoonConfig.backgroundColor === opt.value
                      ? "border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-500/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-slate-300/60"
                    style={{ backgroundColor: opt.value }}
                  />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end md:col-span-2 pt-2">
            <button
              type="button"
              disabled={isSavingComingSoon}
              onClick={handleSaveComingSoonConfig}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {isSavingComingSoon ? "Saving..." : "Save Banner Settings"}
            </button>
          </div>
        </div>

        {/* Coming Soon Products List */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-800">
                Coming Soon Products ({comingSoonProducts.length})
              </h4>
              <p className="text-[11px] font-semibold text-slate-400">
                Products marked with status &quot;coming_soon&quot; appear here and in the storefront preview.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCsProductModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition-all"
              >
                <HiOutlinePlus className="h-4 w-4" />
                <span>Mark Product as Coming Soon</span>
              </button>
              <Link
                to="/admin/products"
                className="flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold"
              >
                <span>Product Management</span>
                <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {comingSoonProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {comingSoonProducts.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:border-purple-300 transition-all group"
                >
                  <img
                    src={p.mainImage || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=200"}
                    alt={p.name}
                    className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      ₹{p.salePrice || p.price || 0}
                    </p>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 mt-1">
                      COMING SOON
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetProductComingSoon(p, false)}
                    title="Remove from Coming Soon (set to Active)"
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-70 group-hover:opacity-100"
                  >
                    <HiOutlineXMark className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              <HiOutlineClock className="h-8 w-8 text-purple-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No products marked Coming Soon yet</p>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">
                Click &quot;Mark Product as Coming Soon&quot; or change product status in Product Management.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSection ? "Edit Offer Section" : "New Offer Section"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Section title
            </label>
            <input
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="E.g. Trending Tuesday!"
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-1 ring-transparent focus:ring-primary/20"
            />
          </div>

          {/* Mode Selector: Manual vs Automatic (Top Selling) */}
          <div className="space-y-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">
                  Product Selection Mode
                </label>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isSectionTwoOffer
                    ? "Curate handpicked admin products with custom offer prices for this section."
                    : "Choose whether this section displays top selling products automatically or handpicked admin products with custom offer prices."}
                </p>
              </div>
            </div>

            <div className={cn("gap-2 pt-1", isSectionTwoOffer ? "grid grid-cols-1" : "grid grid-cols-2")}>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, isAutomatic: false }))}
                className={cn(
                  "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                  !formData.isAutomatic
                    ? "bg-white border-emerald-500 shadow-xs ring-2 ring-emerald-500/20"
                    : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                )}
              >
                <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      !formData.isAutomatic ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  />
                  Manual Mode
                </div>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Pick admin products & set custom offer prices
                </span>
              </button>

              {!isSectionTwoOffer && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isAutomatic: true }))}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-xl border text-left transition-all",
                    formData.isAutomatic
                      ? "bg-white border-purple-600 shadow-xs ring-2 ring-purple-600/20"
                      : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        formData.isAutomatic ? "bg-purple-600" : "bg-slate-300"
                      )}
                    />
                    Automatic Mode (Top Selling)
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Auto-ranks and displays top-selling products
                  </span>
                </button>
              )}
            </div>
          </div>

          {formData.isAutomatic ? (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-900 flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <p className="text-xs font-black">Top Selling Products Mode (Automatic)</p>
                <p className="text-[11px] text-purple-700/80 font-medium mt-0.5">
                  This section will dynamically fetch and display top-selling products based on real-time sales volume. You don&apos;t need to manually select individual products.
                </p>
              </div>
            </div>
          ) : (
            /* Admin Products & Offer Price Selection */
            <div className="space-y-4">
              {/* Selected Products with Offer Price */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <HiOutlineTag className="h-4 w-4 text-emerald-600" />
                    Selected Offer Products ({selectedProducts.length})
                  </label>
                  {selectedProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {selectedProducts.length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center">
                    <p className="text-xs font-bold text-slate-400">
                      No products added yet. Click &quot;+ Add&quot; on admin products below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-2 bg-slate-50/40">
                    {selectedProducts.map((p) => {
                      const pId = String(p._id || p.productId);
                      const regularPrice = Number(p.price || 0);
                      const offerPrice = Number(p.offerPrice || 0);
                      const discountPercent =
                        regularPrice > 0 && offerPrice < regularPrice && offerPrice > 0
                          ? Math.round(((regularPrice - offerPrice) / regularPrice) * 100)
                          : 0;

                      return (
                        <div
                          key={pId}
                          className="flex items-center gap-3 p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs hover:border-slate-300 transition-all"
                        >
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-100 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs flex-shrink-0">
                              📦
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              MRP: ₹{regularPrice}
                              {p.salePrice > 0 && p.salePrice !== regularPrice && (
                                <span className="ml-1 text-slate-500">
                                  (Current Sale: ₹{p.salePrice})
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Offer Price Input */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="relative w-28">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">
                                ₹
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={regularPrice || 999999}
                                value={p.offerPrice}
                                onChange={(e) =>
                                  handleUpdateOfferPrice(pId, e.target.value)
                                }
                                placeholder="Offer price"
                                className="w-full pl-6 pr-2 py-1.5 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs font-black text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-400"
                              />
                            </div>

                            {discountPercent > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black">
                                {discountPercent}% OFF
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(pId)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Remove from section"
                            >
                              <HiOutlineTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Browse / Search Admin Products */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Browse & Add Admin Products
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    disabled={productsFiltered.length === 0}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Select All ({productsFiltered.length})
                  </button>
                </div>

                {/* Optional Category Pills Filter */}
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter("");
                      loadAdminProducts({ categoryId: "" });
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                      !selectedCategoryFilter
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    All Categories
                  </button>
                  {categories.map((c) => {
                    const isSelected = selectedCategoryFilter === c._id;
                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => {
                          const next = isSelected ? "" : c._id;
                          setSelectedCategoryFilter(next);
                          loadAdminProducts({ categoryId: next });
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          loadAdminProducts({ search: productSearch });
                        }
                      }}
                      placeholder="Search admin product by name or SKU..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearch("");
                          loadAdminProducts({ search: "" });
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <HiOutlineXMark className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => loadAdminProducts({ search: productSearch })}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all"
                  >
                    Search
                  </button>
                </div>

                {/* Catalog Grid */}
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                  {isProductsLoading ? (
                    <span className="text-[11px] text-slate-400 font-bold py-2">
                      Loading admin products...
                    </span>
                  ) : productsFiltered.length === 0 ? (
                    <span className="text-[11px] text-slate-400 py-2">
                      No admin products found. Try clearing category or search.
                    </span>
                  ) : (
                    productsFiltered.map((p) => {
                      const pId = String(p._id);
                      const isAdded = selectedProducts.some(
                        (sp) => String(sp._id || sp.productId) === pId
                      );

                      return (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => {
                            if (isAdded) {
                              handleRemoveProduct(pId);
                            } else {
                              handleAddProduct(p);
                            }
                          }}
                          className={cn(
                            "px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5",
                            isAdded
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          <span>{p.name}</span>
                          <span className="text-[10px] opacity-75">
                            (₹{p.salePrice || p.price})
                          </span>
                          {isAdded ? (
                            <HiOutlineCheck className="h-3.5 w-3.5 stroke-2" />
                          ) : (
                            <HiOutlinePlus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Banner Colour */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Banner colour
            </label>
            <div className="flex flex-wrap gap-2">
              {BACKGROUND_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      backgroundColor: opt.value,
                    }))
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold border-2 transition-all",
                    formData.backgroundColor === opt.value
                      ? "border-slate-900 ring-2 ring-offset-2 ring-slate-400"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                  title={opt.label}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-slate-200"
                    style={{ backgroundColor: opt.value }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Side Image */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Side image (choose one)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SIDE_IMAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      sideImageKey: opt.key,
                    }))
                  }
                  className={cn(
                    "rounded-xl overflow-hidden border-2 transition-all aspect-square bg-slate-100",
                    formData.sideImageKey === opt.key
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <img
                    src={opt.imageUrl}
                    alt={opt.label}
                    className="w-full h-full object-cover"
                  />
                  <span className="block text-[10px] font-bold text-slate-600 p-1 truncate">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Order & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Display order
              </label>
              <input
                type="number"
                min={0}
                value={formData.order}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, order: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
            >
              {editingSection ? "Save changes" : "Create section"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Add to Coming Soon Modal */}
      <Modal
        isOpen={isAddCsModalOpen}
        onClose={() => setIsAddCsModalOpen(false)}
        title="Mark Product as Coming Soon"
      >
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            Select products to showcase in the Coming Soon section. These products will have an unreleased status on the storefront.
          </p>
          <div className="relative">
            <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              value={csProductSearch}
              onChange={(e) => setCsProductSearch(e.target.value)}
              placeholder="Search admin products by name..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {isLoadingCsModalProds ? (
              <div className="p-8 text-center text-xs font-bold text-slate-400">Loading products...</div>
            ) : (
              allAdminProductsForCs
                .filter((p) =>
                  csProductSearch
                    ? p.name?.toLowerCase().includes(csProductSearch.toLowerCase())
                    : true
                )
                .map((product) => {
                  const isCs =
                    product.status === "coming_soon" ||
                    comingSoonProducts.some((c) => c._id === product._id);
                  return (
                    <div
                      key={product._id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/80 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={product.mainImage || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=200"}
                          alt={product.name}
                          className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-100 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{product.name}</p>
                          <p className="text-[10px] font-semibold text-slate-400">₹{product.salePrice || product.price || 0}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await handleSetProductComingSoon(product, !isCs);
                          setAllAdminProductsForCs((prev) =>
                            prev.map((p) =>
                              p._id === product._id
                                ? { ...p, status: !isCs ? "coming_soon" : "active" }
                                : p
                            )
                          );
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                          isCs
                            ? "bg-purple-100 text-purple-700 hover:bg-rose-50 hover:text-rose-600"
                            : "bg-slate-100 text-slate-700 hover:bg-purple-600 hover:text-white"
                        )}
                      >
                        {isCs ? "Coming Soon ✓" : "+ Mark Coming Soon"}
                      </button>
                    </div>
                  );
                })
            )}
            {!isLoadingCsModalProds && allAdminProductsForCs.length === 0 && (
              <div className="p-8 text-center text-xs font-bold text-slate-400">No products found</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OfferSectionsManagement;
