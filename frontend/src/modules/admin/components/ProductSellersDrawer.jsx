import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import {
    HiOutlineXMark,
    HiOutlineBuildingStorefront,
    HiOutlineUser,
    HiOutlinePhone,
    HiOutlineMapPin,
    HiOutlineArchiveBox,
    HiOutlineCheckCircle,
    HiOutlineExclamationTriangle,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineSwatch,
    HiOutlineCurrencyRupee,
    HiOutlineArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function ProductSellersDrawer({ isOpen, onClose, product }) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStock, setFilterStock] = useState('all'); // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

    useEffect(() => {
        if (!isOpen || !product?._id) {
            setData(null);
            setSearchTerm('');
            setFilterStock('all');
            return;
        }

        const fetchSellers = async () => {
            setIsLoading(true);
            try {
                const response = await adminApi.getProductSellers(product._id);
                if (response.data?.success) {
                    setData(response.data.result);
                } else {
                    toast.error(response.data?.message || 'Failed to fetch sellers');
                }
            } catch (err) {
                console.error('Error fetching product sellers:', err);
                toast.error('Could not load sellers for this product');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSellers();
    }, [isOpen, product?._id]);

    // Handle ESC key close
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const sellersList = data?.sellers || [];
    const masterInfo = data?.masterProduct || product;
    const summary = data?.summary || {
        totalSellers: 0,
        totalSellerStock: 0,
        totalCombinedStock: Number(product?.stock || 0),
        activeSellersCount: 0,
        inStockSellersCount: 0,
    };

    const filteredSellers = useMemo(() => {
        return sellersList.filter((item) => {
            const seller = item.seller || {};
            const matchesSearch =
                !searchTerm.trim() ||
                (seller.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (seller.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (seller.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (seller.locality || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (seller.phone || '').includes(searchTerm);

            if (!matchesSearch) return false;

            if (filterStock === 'in_stock') return item.stock > 10;
            if (filterStock === 'low_stock') return item.stock > 0 && item.stock <= 10;
            if (filterStock === 'out_of_stock') return item.stock === 0;

            return true;
        });
    }, [sellersList, searchTerm, filterStock]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer"
                    />

                    {/* Slide-over Drawer Panel */}
                    <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col pointer-events-auto border-l border-slate-200/80"
                        >
                            {/* Drawer Header */}
                            <div className="p-6 border-b border-slate-100 bg-slate-50/70">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden bg-white ring-1 ring-slate-200/80 shadow-sm p-1.5 flex items-center justify-center">
                                            <img
                                                src={masterInfo?.mainImage || masterInfo?.images?.[0] || '/placeholder.png'}
                                                alt={masterInfo?.name || 'Product'}
                                                className="h-full w-full object-contain"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 ring-1 ring-purple-100">
                                                    Master Catalog
                                                </span>
                                                {masterInfo?.sku && (
                                                    <span className="text-[10px] font-mono text-slate-400">
                                                        SKU: {masterInfo.sku}
                                                    </span>
                                                )}
                                            </div>
                                            <h2 className="text-lg font-bold text-slate-900 truncate mt-1" title={masterInfo?.name}>
                                                {masterInfo?.name || 'Product Sellers'}
                                            </h2>
                                            <p className="text-xs text-slate-500 font-medium">
                                                Admin Warehouse Stock: <span className="font-bold text-slate-800">{masterInfo?.stock ?? 0} units</span>
                                                {masterInfo?.price && (
                                                    <span className="ml-2 text-slate-400">• Base MRP: ₹{masterInfo.price}</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white shadow-sm ring-1 ring-slate-200/70 transition-all cursor-pointer"
                                        title="Close (Esc)"
                                    >
                                        <HiOutlineXMark className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* KPI Metrics */}
                                <div className="grid grid-cols-3 gap-3 mt-5">
                                    <div className="bg-white p-3 rounded-xl ring-1 ring-slate-100 shadow-xs">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Sellers</p>
                                        <p className="text-lg font-black text-slate-800 mt-0.5">
                                            {summary.totalSellers} <span className="text-xs font-semibold text-slate-400">shops</span>
                                        </p>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl ring-1 ring-slate-100 shadow-xs">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Seller Inventory</p>
                                        <p className="text-lg font-black text-blue-600 mt-0.5">
                                            {summary.totalSellerStock} <span className="text-xs font-semibold text-slate-400">units</span>
                                        </p>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl ring-1 ring-slate-100 shadow-xs">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Combined</p>
                                        <p className="text-lg font-black text-emerald-600 mt-0.5">
                                            {summary.totalCombinedStock} <span className="text-xs font-semibold text-slate-400">units</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Search & Stock Filter Toolbar */}
                            <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                                <div className="relative w-full sm:flex-1">
                                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by shop, owner, city..."
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                                    />
                                </div>
                                <div className="flex gap-1.5 w-full sm:w-auto shrink-0 overflow-x-auto pb-1 sm:pb-0">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'in_stock', label: 'In Stock' },
                                        { key: 'low_stock', label: 'Low Stock' },
                                        { key: 'out_of_stock', label: 'Out of Stock' },
                                    ].map((f) => (
                                        <button
                                            key={f.key}
                                            onClick={() => setFilterStock(f.key)}
                                            className={cn(
                                                'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer',
                                                filterStock === f.key
                                                    ? 'bg-slate-900 text-white shadow-xs'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200/60'
                                            )}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sellers List Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
                                {isLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                                        <HiOutlineArrowPath className="h-7 w-7 text-primary animate-spin" />
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            Loading Sellers Inventory...
                                        </p>
                                    </div>
                                ) : filteredSellers.length === 0 ? (
                                    <div className="py-16 px-4 text-center bg-white rounded-2xl ring-1 ring-slate-100 shadow-xs flex flex-col items-center justify-center">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3 ring-1 ring-slate-100">
                                            <HiOutlineBuildingStorefront className="h-7 w-7" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800">
                                            {searchTerm || filterStock !== 'all' ? 'No matching sellers found' : 'No sellers have this product yet'}
                                        </h3>
                                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                                            {searchTerm || filterStock !== 'all'
                                                ? 'Try adjusting your search query or stock filter to view other sellers.'
                                                : 'When sellers request and add this master catalog product into their inventory, they will appear here.'}
                                        </p>
                                    </div>
                                ) : (
                                    filteredSellers.map((item) => {
                                        const seller = item.seller || {};
                                        const isLowStock = item.stock > 0 && item.stock <= 10;
                                        const isOutOfStock = item.stock === 0;

                                        return (
                                            <div
                                                key={item._id}
                                                className="bg-white rounded-2xl p-5 ring-1 ring-slate-100 shadow-xs hover:shadow-md transition-all group border-l-4"
                                                style={{
                                                    borderLeftColor: isOutOfStock
                                                        ? '#f43f5e'
                                                        : isLowStock
                                                        ? '#f59e0b'
                                                        : '#10b981',
                                                }}
                                            >
                                                {/* Header row: Shop Name & Status */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 ring-1 ring-blue-100">
                                                                <HiOutlineBuildingStorefront className="h-4 w-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="text-sm font-bold text-slate-900 truncate">
                                                                    {seller.shopName || 'Unknown Shop'}
                                                                </h4>
                                                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                                    <span className="flex items-center gap-1 font-medium">
                                                                        <HiOutlineUser className="h-3 w-3 text-slate-400" />
                                                                        {seller.name || 'Owner'}
                                                                    </span>
                                                                    {(seller.city || seller.locality) && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="flex items-center gap-0.5 truncate">
                                                                                <HiOutlineMapPin className="h-3 w-3 text-slate-400" />
                                                                                {[seller.locality, seller.city].filter(Boolean).join(', ')}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Stock Badge */}
                                                    <div className="text-right shrink-0">
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                                                                isOutOfStock
                                                                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                                                                    : isLowStock
                                                                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                                                    : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                                            )}
                                                        >
                                                            {isOutOfStock ? (
                                                                <HiOutlineExclamationTriangle className="h-3.5 w-3.5 text-rose-600" />
                                                            ) : (
                                                                <HiOutlineCheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                                            )}
                                                            <span>{item.stock} in stock</span>
                                                        </span>
                                                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
                                                            {isOutOfStock ? 'Out of stock' : isLowStock ? 'Low stock alert' : 'Healthy inventory'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Price & Contact Bar */}
                                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <span className="text-[10px] uppercase font-bold text-slate-400">Seller Price: </span>
                                                            <span className="font-extrabold text-slate-900">₹{item.salePrice || item.price}</span>
                                                            {item.salePrice && item.price && item.salePrice < item.price && (
                                                                <span className="ml-1 text-[11px] line-through text-slate-400">₹{item.price}</span>
                                                            )}
                                                        </div>
                                                        {seller.phone && (
                                                            <a
                                                                href={`tel:${seller.phone}`}
                                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition-colors"
                                                            >
                                                                <HiOutlinePhone className="h-3.5 w-3.5 text-slate-400" />
                                                                <span>{seller.phone}</span>
                                                            </a>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onClose();
                                                            navigate('/admin/sellers');
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                                                    >
                                                        <span>View Seller</span>
                                                        <HiOutlineArrowTopRightOnSquare className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>

                                                {/* Variants Breakdown if applicable */}
                                                {item.variants && item.variants.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-slate-50 bg-slate-50/70 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mb-2">
                                                            <HiOutlineSwatch className="h-3 w-3 text-purple-500" />
                                                            Variant Inventory:
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {item.variants.map((v, vIdx) => (
                                                                <div
                                                                    key={v._id || vIdx}
                                                                    className="bg-white px-2.5 py-1 rounded-lg ring-1 ring-slate-200/80 text-[11px] flex items-center gap-2 shadow-2xs"
                                                                >
                                                                    <span className="font-semibold text-slate-700">{v.name || 'Default'}</span>
                                                                    <span className="text-slate-300">•</span>
                                                                    <span className={cn(
                                                                        'font-bold',
                                                                        (v.stock || 0) === 0 ? 'text-rose-600' : (v.stock || 0) <= 5 ? 'text-amber-600' : 'text-emerald-700'
                                                                    )}>
                                                                        {v.stock || 0} units
                                                                    </span>
                                                                    {v.price && (
                                                                        <>
                                                                            <span className="text-slate-300">•</span>
                                                                            <span className="text-slate-500">₹{v.salePrice || v.price}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    Displaying {filteredSellers.length} of {summary.totalSellers} sellers carrying this item
                                </span>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors cursor-pointer text-xs"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
