import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import {
    Users,
    Search,
    Download,
    Eye,
    Phone,
    ShoppingBag,
    MoreVertical,
    UserPlus,
    RotateCw,
    Activity,
    Loader2,
    MapPin,
    Trash2,
    AlertTriangle,
    Calendar,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    X,
    Filter,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Pagination from '@shared/components/ui/Pagination';
import Modal from '@shared/components/ui/Modal';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';

const LOCATION_SOURCE_LABELS = {
    order: 'Last order',
    login: 'App location',
    address: 'Saved address',
    profile: 'Profile location',
};

const DATE_SORT_OPTIONS = [
    { id: 'asc', label: 'Ascending Date (Oldest First)', shortLabel: 'Date: Oldest First', icon: ArrowUp },
    { id: 'desc', label: 'Descending Date (Newest First)', shortLabel: 'Date: Newest First', icon: ArrowDown },
    { id: 'orders', label: 'Most Orders (Activity)', shortLabel: 'Sort: Most Orders', icon: Activity },
];

const DATE_RANGE_OPTIONS = [
    'All Time',
    'Today',
    'Yesterday',
    'Last 7 Days',
    'Last 30 Days',
    'This Month',
    'Custom',
];

const CustomerManagement = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [dateSort, setDateSort] = useState('desc');
    const [dateRange, setDateRange] = useState('All Time');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isDateSortMenuOpen, setIsDateSortMenuOpen] = useState(false);
    const [isDateRangeMenuOpen, setIsDateRangeMenuOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [customerToDelete, setCustomerToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const hasActiveFilters = Boolean(
        searchTerm.trim() ||
        locationFilter.trim() ||
        filterStatus !== 'all' ||
        dateSort !== 'desc' ||
        dateRange !== 'All Time' ||
        startDate ||
        endDate
    );

    const handleResetFilters = () => {
        setSearchTerm('');
        setLocationFilter('');
        setFilterStatus('all');
        setDateSort('desc');
        setDateRange('All Time');
        setStartDate('');
        setEndDate('');
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCustomers(1);
        }, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm, locationFilter, filterStatus, dateSort, dateRange, startDate, endDate]);

    const fetchCustomers = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (locationFilter.trim()) params.location = locationFilter.trim();
            if (filterStatus !== 'all') params.status = filterStatus;

            if (dateSort === 'asc' || dateSort === 'desc') {
                params.dateSort = dateSort;
            } else if (dateSort === 'orders') {
                params.sortBy = 'totalOrders';
            }

            if (dateRange !== 'All Time') {
                if (dateRange === 'Custom') {
                    if (startDate) params.startDate = startDate;
                    if (endDate) params.endDate = endDate;
                } else {
                    params.dateRange = dateRange.toLowerCase().replace(/[\s-]+/g, '_');
                }
            }

            const { data } = await adminApi.getUsers(params);
            if (data.success) {
                const payload = data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (data.results || []);
                setCustomers(list);
                if (typeof payload.total === 'number') {
                    setTotal(payload.total);
                } else {
                    setTotal(list.length);
                }
                if (typeof payload.page === 'number') {
                    setPage(payload.page);
                } else {
                    setPage(requestedPage);
                }
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCustomer = async () => {
        if (!customerToDelete) return;
        try {
            setIsDeleting(true);
            const { data } = await adminApi.deleteUser(customerToDelete.id);
            if (data.success) {
                toast.success("Customer deleted successfully");
                setCustomerToDelete(null);
                fetchCustomers(page);
            } else {
                toast.error(data.message || "Failed to delete customer");
            }
        } catch (error) {
            console.error("Error deleting customer:", error);
            toast.error(error.response?.data?.message || "Failed to delete customer");
        } finally {
            setIsDeleting(false);
        }
    };

    const stats = useMemo(() => {
        const safeCustomers = Array.isArray(customers) ? customers : [];
        return {
            total: total,
            active: safeCustomers.filter(c => c.status === 'active').length,
            newToday: safeCustomers.filter(c => {
                if (!c.joinedDate) return false;
                const today = new Date().toISOString().split('T')[0];
                const joined = new Date(c.joinedDate).toISOString().split('T')[0];
                return joined === today;
            }).length
        };
    }, [customers, total]);

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            setIsExporting(false);
            toast.success('Customer database exported successfully!');
        }, 1500);
    };

    const formatDate = (date) => {
        if (!date) return null;
        try {
            const d = new Date(date);
            return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return null;
        }
    };

    const getTimeAgo = (date) => {
        if (!date) return 'Never';
        try {
            const past = new Date(date);
            if (isNaN(past.getTime())) return 'Never';
            const now = new Date();
            const diffInMs = now - past;
            const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

            if (diffInHours < 1) return 'Recently';
            if (diffInHours < 24) return `${diffInHours}h ago`;
            const diffInDays = Math.floor(diffInHours / 24);
            return `${diffInDays}d ago`;
        } catch {
            return 'Never';
        }
    };

    const currentSortOption = DATE_SORT_OPTIONS.find(o => o.id === dateSort) || DATE_SORT_OPTIONS[1];
    const SortIcon = currentSortOption.icon;

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Customers"
                description="Manage and track all customer accounts"
                badge={
                    <div className="ds-stat-card-icon bg-brand-50">
                        <Users className="ds-icon-lg text-brand-600" />
                    </div>
                }
                actions={
                    <>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="ds-btn ds-btn-md bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            {isExporting ? <RotateCw className="ds-icon-sm animate-spin" /> : <Download className="ds-icon-sm" />}
                            {isExporting ? 'EXPORTING...' : 'EXPORT'}
                        </button>
                        <button className="ds-btn ds-btn-md bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <UserPlus className="ds-icon-sm" />
                            NEW CUSTOMER
                        </button>
                    </>
                }
            />

            {/* Quick Stats Grid */}
            <div className="ds-grid-cards-3">
                <StatCard
                    label="Total Customers"
                    value={stats.total}
                    icon={Users}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
                <StatCard
                    label="Active Users"
                    value={stats.active}
                    icon={Activity}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
                <StatCard
                    label="New Today"
                    value={stats.newToday}
                    icon={UserPlus}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
            </div>

            {/* Filter & Search Bar */}
            <Card className="ds-card-compact space-y-3 relative z-30">
                {/* Search & Location Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                    <div className="relative flex items-center w-full">
                        <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by customer name, email or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="relative flex items-center w-full">
                        <MapPin className="absolute left-3.5 h-4 w-4 text-emerald-600 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Filter by location / city (e.g. Indore, Sagwara)..."
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                        />
                        {locationFilter && (
                            <button
                                type="button"
                                onClick={() => setLocationFilter('')}
                                className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Controls Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-gray-100">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Date Sorting Menu */}
                        <div className={cn("relative", isDateSortMenuOpen && "z-50")}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsDateSortMenuOpen(!isDateSortMenuOpen);
                                    setIsDateRangeMenuOpen(false);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
                                    dateSort === 'asc'
                                        ? "bg-brand-50 border-brand-300 text-brand-700 shadow-sm"
                                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                )}
                            >
                                <SortIcon className="h-3.5 w-3.5 text-brand-600" />
                                <span>{currentSortOption.shortLabel}</span>
                                <ArrowUpDown className="h-3 w-3 text-gray-400 ml-0.5" />
                            </button>

                            <AnimatePresence>
                                {isDateSortMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsDateSortMenuOpen(false)}
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                            className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50"
                                        >
                                            <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                                                Sort Customer Data
                                            </p>
                                            {DATE_SORT_OPTIONS.map((opt) => {
                                                const Icon = opt.icon;
                                                const isSelected = dateSort === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setDateSort(opt.id);
                                                            setIsDateSortMenuOpen(false);
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left",
                                                            isSelected
                                                                ? "bg-brand-50 text-brand-700 font-bold"
                                                                : "text-gray-600 hover:bg-gray-50"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Icon className={cn("h-4 w-4", isSelected ? "text-brand-600" : "text-gray-400")} />
                                                            <span>{opt.label}</span>
                                                        </div>
                                                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Date Range Menu */}
                        <div className={cn("relative", isDateRangeMenuOpen && "z-50")}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsDateRangeMenuOpen(!isDateRangeMenuOpen);
                                    setIsDateSortMenuOpen(false);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border",
                                    dateRange !== 'All Time'
                                        ? "bg-brand-50 border-brand-300 text-brand-700 shadow-sm"
                                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                )}
                            >
                                <Calendar className="h-3.5 w-3.5 text-brand-600" />
                                <span>{dateRange}</span>
                            </button>

                            <AnimatePresence>
                                {isDateRangeMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsDateRangeMenuOpen(false)}
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                            className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50"
                                        >
                                            <p className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                                                Filter By Date Joined
                                            </p>
                                            {DATE_RANGE_OPTIONS.map((range) => {
                                                const isSelected = dateRange === range;
                                                return (
                                                    <button
                                                        key={range}
                                                        type="button"
                                                        onClick={() => {
                                                            setDateRange(range);
                                                            if (range !== 'Custom') {
                                                                setIsDateRangeMenuOpen(false);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left",
                                                            isSelected
                                                                ? "bg-brand-50 text-brand-700 font-bold"
                                                                : "text-gray-600 hover:bg-gray-50"
                                                        )}
                                                    >
                                                        <span>{range}</span>
                                                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                                                    </button>
                                                );
                                            })}

                                            {dateRange === 'Custom' && (
                                                <div className="pt-2 mt-2 border-t border-gray-100 space-y-2 px-1">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">From</label>
                                                        <input
                                                            type="date"
                                                            value={startDate}
                                                            onChange={(e) => setStartDate(e.target.value)}
                                                            className="w-full text-xs p-1.5 border border-gray-200 rounded-lg outline-none focus:border-primary"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-gray-400 block mb-1">To</label>
                                                        <input
                                                            type="date"
                                                            value={endDate}
                                                            onChange={(e) => setEndDate(e.target.value)}
                                                            className="w-full text-xs p-1.5 border border-gray-200 rounded-lg outline-none focus:border-primary"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsDateRangeMenuOpen(false)}
                                                        className="w-full py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition-all mt-1"
                                                    >
                                                        Apply Custom Dates
                                                    </button>
                                                </div>
                                            )}
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Status Pills */}
                        <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200/60">
                            {['all', 'active', 'inactive'].map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg ds-caption capitalize transition-all font-bold",
                                        filterStatus === status ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reset Button */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all border border-rose-200/60"
                        >
                            <X className="h-3.5 w-3.5" />
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>

                {/* Active Filter Tags */}
                {locationFilter.trim() && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium">Filtering by Location:</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-lg">
                            <MapPin className="h-3 w-3" />
                            "{locationFilter.trim()}"
                            <button
                                type="button"
                                onClick={() => setLocationFilter('')}
                                className="hover:text-primary-foreground hover:bg-primary/50 rounded-full p-0.5 transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                        <span className="text-gray-400">({total} customer{total === 1 ? '' : 's'} matching location/orders)</span>
                    </div>
                )}
            </Card>

            {/* Customer List Table */}
            <Card className="overflow-hidden relative z-0 min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="ds-caption text-gray-500 font-medium">Loading Customers...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="ds-table">
                        <thead className="ds-table-header">
                            <tr>
                                <th className="ds-table-header-cell">Customer</th>
                                <th className="ds-table-header-cell">Activity</th>
                                <th className="ds-table-header-cell">Location</th>
                                <th className="ds-table-header-cell">Total Spend</th>
                                <th className="ds-table-header-cell">Status</th>
                                <th className="ds-table-header-cell text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && customers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-gray-50 rounded-full">
                                                <Users className="h-8 w-8 text-gray-300" />
                                            </div>
                                            <p className="ds-h4 text-gray-400">
                                                {locationFilter.trim()
                                                    ? `No customers found for location "${locationFilter.trim()}"`
                                                    : 'No customers found'}
                                            </p>
                                            {hasActiveFilters && (
                                                <button
                                                    type="button"
                                                    onClick={handleResetFilters}
                                                    className="text-xs text-primary font-bold hover:underline"
                                                >
                                                    Clear all filters
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                customers.map((cust) => {
                                    const locText = cust.location
                                        ? [cust.location.city, cust.location.state].filter(Boolean).join(', ') || cust.location.address
                                        : (Array.isArray(cust.orderCities) && cust.orderCities.length > 0 ? cust.orderCities[0] : '');
                                    const isLocationMatched = Boolean(
                                        locationFilter.trim() &&
                                        (locText.toLowerCase().includes(locationFilter.trim().toLowerCase()) ||
                                         (Array.isArray(cust.orderCities) && cust.orderCities.some(c => c && c.toLowerCase().includes(locationFilter.trim().toLowerCase()))))
                                    );
                                    const joinedStr = formatDate(cust.joinedDate);

                                    return (
                                        <tr key={cust.id} className="ds-table-row hover:bg-slate-50/50 transition-colors">
                                            <td className="ds-table-cell">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={cust.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                                                        alt=""
                                                        className="h-10 w-10 rounded-lg bg-gray-100 ring-2 ring-white shadow-sm object-cover shrink-0"
                                                    />
                                                    <div>
                                                        <p
                                                            onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                            className="ds-h4 hover:text-primary cursor-pointer transition-colors"
                                                        >
                                                            {cust.name}
                                                        </p>
                                                        <p className="ds-body-sm text-gray-500">{cust.email || 'No email'}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <Phone className="ds-icon-sm text-gray-300" />
                                                            <span className="text-[9px] text-gray-400">{cust.phone}</span>
                                                        </div>
                                                        {joinedStr && (
                                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 font-medium">
                                                                <Calendar className="h-3 w-3 text-gray-400 shrink-0" />
                                                                <span>Joined: {joinedStr}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="ds-table-cell">
                                                <div>
                                                    <div className="flex items-center gap-1.5 ds-body font-semibold">
                                                        <ShoppingBag className="ds-icon-sm text-primary shrink-0" />
                                                        <span>{cust.totalOrders || 0} Orders</span>
                                                    </div>
                                                    <p className="ds-body-sm text-gray-400 mt-0.5">Last: {getTimeAgo(cust.lastOrderDate)}</p>
                                                    {Array.isArray(cust.recentOrders) && cust.recentOrders.length > 0 && (
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {cust.recentOrders.slice(0, 2).map((ro, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    onClick={() => navigate(`/admin/orders/view/${ro.orderId}`)}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-mono cursor-pointer transition-colors"
                                                                    title={`View order #${ro.orderId}${ro.city ? ` (${ro.city})` : ''}`}
                                                                >
                                                                    <span>#{ro.orderId.slice(-6)}</span>
                                                                    {ro.city && <span className="text-slate-500 font-sans font-medium">({ro.city})</span>}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="ds-table-cell">
                                                {locText ? (
                                                    <div className="max-w-[240px]" title={cust.location?.address || locText}>
                                                        <div className="flex items-center gap-1.5 ds-body font-semibold">
                                                            <MapPin className={cn("ds-icon-sm shrink-0", isLocationMatched ? "text-emerald-600" : "text-primary")} />
                                                            <span className={cn("truncate", isLocationMatched && "text-emerald-700 font-black")}>
                                                                {locText}
                                                            </span>
                                                            {isLocationMatched && (
                                                                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded shrink-0">
                                                                    Matched
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="ds-body-sm text-gray-400 mt-0.5">
                                                            {LOCATION_SOURCE_LABELS[cust.location?.source] || (cust.totalOrders > 0 ? 'Order location' : 'Location')}
                                                            {cust.location?.at ? ` · ${getTimeAgo(cust.location.at)}` : ''}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="ds-body-sm text-gray-400">Not available</span>
                                                )}
                                            </td>
                                            <td className="ds-table-cell ds-h4">
                                                ₹{(cust.totalSpent || 0).toLocaleString()}
                                            </td>
                                            <td className="ds-table-cell">
                                                <Badge
                                                    variant={cust.status === 'active' ? 'success' : 'error'}
                                                    className="ds-badge"
                                                >
                                                    {cust.status}
                                                </Badge>
                                            </td>
                                            <td className="ds-table-cell text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => navigate(`/admin/customers/${cust.id}`)}
                                                        title="View Customer Profile & Orders"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        <span>View</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setCustomerToDelete(cust)}
                                                        title="Delete Customer"
                                                        className="p-1.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                        )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-gray-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchCustomers(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={Boolean(customerToDelete)}
                onClose={() => !isDeleting && setCustomerToDelete(null)}
                title="Delete Customer"
                size="sm"
            >
                <div className="space-y-4 pt-2">
                    <div className="flex items-start gap-3 p-3.5 bg-rose-50 rounded-xl border border-rose-100 text-rose-800">
                        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed">
                            <p className="font-bold text-rose-900">Are you sure you want to delete this customer?</p>
                            <p className="mt-1 text-rose-700">This action will permanently delete the customer account and clean up their associated cart, wishlist, and wallet data. This cannot be undone.</p>
                        </div>
                    </div>

                    {customerToDelete && (
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Name:</span>
                                <span className="font-semibold text-gray-900">{customerToDelete.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Phone:</span>
                                <span className="font-mono font-medium text-gray-700">{customerToDelete.phone}</span>
                            </div>
                            {customerToDelete.email && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Email:</span>
                                    <span className="text-gray-700">{customerToDelete.email}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setCustomerToDelete(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isDeleting}
                            onClick={handleDeleteCustomer}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-200 transition-all disabled:opacity-50"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    Delete Customer
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CustomerManagement;
