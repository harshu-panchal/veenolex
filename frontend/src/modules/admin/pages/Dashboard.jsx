import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import PageHeader from '@shared/components/ui/PageHeader';
import StatCard from '@shared/components/ui/StatCard';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import {
    Users,
    Store,
    Truck,
    BarChart3,
    Activity,
    Database,
    RotateCw,
    Loader2,
    CalendarDays,
    X
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const formatLocalDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const shiftDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatLocalDate(d);
};

const formatDateLabel = (value) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_VARIANTS = {
    delivered: 'success',
    cancelled: 'error',
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const todayStr = formatLocalDate(new Date());

    // Either bound alone means a single day; swapped bounds are normalised.
    const rangeStart = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : (fromDate || toDate);
    const rangeEnd = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : (fromDate || toDate);
    const isFiltered = Boolean(rangeStart);
    const isSingleDay = isFiltered && rangeStart === rangeEnd;

    const applyRange = (from, to) => {
        setFromDate(from);
        setToDate(to);
    };

    const presets = [
        { label: 'Today', from: todayStr, to: todayStr },
        { label: 'Yesterday', from: shiftDays(-1), to: shiftDays(-1) },
        { label: 'Last 7 days', from: shiftDays(-6), to: todayStr },
        { label: 'Last 30 days', from: shiftDays(-29), to: todayStr },
    ];

    useEffect(() => {
        let cancelled = false;
        const fetchStats = async () => {
            setRefreshing(true);
            try {
                const res = await adminApi.getStats(isFiltered ? { from: rangeStart, to: rangeEnd } : undefined);
                if (!cancelled && res.data.success) {
                    setStatsData(res.data.result);
                    setLastUpdatedAt(new Date());
                }
            } catch (error) {
                console.error("Dashboard Stats Error:", error);
                if (!cancelled) toast.error("Failed to fetch dashboard data");
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        };
        fetchStats();
        return () => { cancelled = true; };
    }, [isFiltered, rangeStart, rangeEnd]);

    if (loading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Synchronizing Data...</p>
            </div>
        );
    }

    const overview = statsData?.overview || {};
    const daySummary = isFiltered ? statsData?.daySummary : null;
    const rangeLabel = !isFiltered
        ? ''
        : isSingleDay
            ? formatDateLabel(rangeStart)
            : `${formatDateLabel(rangeStart)} – ${formatDateLabel(rangeEnd)}`;
    // "on 22 Sept 2026" or "from 1 Sept 2026 to 22 Sept 2026"
    const rangePhrase = isSingleDay
        ? `on ${rangeLabel}`
        : isFiltered ? `from ${formatDateLabel(rangeStart)} to ${formatDateLabel(rangeEnd)}` : '';
    const formatLastUpdated = (value) => {
        if (!value) return 'Last Update: --';
        const now = new Date();
        const updated = new Date(value);
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const updatedDate = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate());
        const dayDiff = Math.round((nowDate - updatedDate) / (1000 * 60 * 60 * 24));

        let dayLabel = updated.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (dayDiff === 0) dayLabel = 'Today';
        if (dayDiff === 1) dayLabel = 'Yesterday';

        const timeLabel = updated.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
        return `Last Update: ${dayLabel}, ${timeLabel}`;
    };

    const stats = [
        {
            label: isFiltered ? 'New Users' : 'Total Users',
            value: overview.totalUsers?.toLocaleString() || '0',
            icon: Users,
            color: 'text-brand-600',
            bg: 'bg-brand-50',
            trend: isFiltered ? undefined : '+12.5%',
            description: isFiltered ? `Signed up ${rangePhrase}` : 'Active this month',
            path: '/admin/customers'
        },
        {
            label: isFiltered ? 'Selling Stores' : 'Active Sellers',
            value: overview.activeSellers?.toLocaleString() || '0',
            icon: Store,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            trend: isFiltered ? undefined : '+5.2%',
            description: isFiltered ? 'Sellers with orders' : 'Verified stores',
            path: '/admin/sellers/active'
        },
        {
            label: isFiltered ? 'Orders' : 'Total Orders',
            value: overview.totalOrders?.toLocaleString() || '0',
            icon: Truck,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            trend: isFiltered ? undefined : '+18.4%',
            description: isFiltered ? `Placed ${rangePhrase}` : 'Last 30 days',
            path: '/admin/orders/all'
        },
        {
            label: 'Revenue',
            value: `₹${overview.totalRevenue?.toLocaleString() || '0'}`,
            icon: BarChart3,
            color: 'text-brand-600',
            bg: 'bg-brand-50',
            trend: isFiltered ? undefined : '+8.2%',
            description: isFiltered ? 'Delivered orders' : 'Net earnings',
            path: '/admin/wallet'
        },
    ];

    const chartData = statsData?.revenueHistory || [];
    const categoryData = statsData?.categoryData || [];
    const recentOrders = statsData?.recentOrders || [];
    const topProducts = statsData?.topProducts || [];

    return (
        <div className="ds-section-spacing">
            <PageHeader
                title="Dashboard"
                description="Overview of your platform's performance."
                actions={
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white pl-3 pr-1 h-9">
                                <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
                                <input
                                    type="date"
                                    value={fromDate}
                                    max={toDate || todayStr}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="h-8 px-1 bg-transparent text-sm font-semibold text-gray-700 focus:outline-none"
                                    aria-label="From date"
                                />
                                <span className="text-xs font-bold text-gray-400">to</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    min={fromDate || undefined}
                                    max={todayStr}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="h-8 px-1 bg-transparent text-sm font-semibold text-gray-700 focus:outline-none"
                                    aria-label="To date"
                                />
                            </div>
                            {presets.map((preset) => {
                                const active = rangeStart === preset.from && rangeEnd === preset.to;
                                return (
                                    <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => applyRange(preset.from, preset.to)}
                                        className={cn(
                                            "h-9 px-3 rounded-xl text-xs font-bold transition-all",
                                            active ? "bg-primary text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                        )}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                            {isFiltered && (
                                <button
                                    type="button"
                                    onClick={() => applyRange('', '')}
                                    className="h-9 px-3 rounded-xl bg-gray-50 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all flex items-center gap-1"
                                >
                                    <X className="h-3.5 w-3.5" /> All time
                                </button>
                            )}
                            {refreshing && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                        </div>
                        <Badge variant="outline" className="ds-badge ds-badge-gray">
                            {formatLastUpdated(lastUpdatedAt)}
                        </Badge>
                    </>
                }
            />

            {isFiltered && (
                <p className="text-sm font-semibold text-gray-500">
                    Showing data for <span className="text-gray-900">{rangeLabel}</span>
                </p>
            )}

            {/* Main Stats Grid */}
            <div className="ds-grid-stats">
                {stats.map((stat) => (
                    <StatCard
                        key={stat.label}
                        label={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        trend={stat.trend}
                        description={stat.description}
                        color={stat.color}
                        bg={stat.bg}
                        onClick={() => navigate(stat.path)}
                        className={cn("ring-1 ring-gray-100", stat.bg + "/30")}
                    />
                ))}
            </div>

            {daySummary && (
                <Card
                    title={isSingleDay ? "Day Summary" : "Period Summary"}
                    subtitle={`Sales breakdown for ${rangeLabel}`}
                    className="border-none shadow-sm ring-1 ring-gray-100"
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Gross Sales', value: `₹${daySummary.grossSales.toLocaleString('en-IN')}`, hint: 'Excl. cancelled' },
                            { label: 'Avg Order Value', value: `₹${daySummary.avgOrderValue.toLocaleString('en-IN')}` },
                            { label: 'Cancelled Orders', value: daySummary.cancelledOrders.toLocaleString() },
                            { label: 'New Sign-ups', value: `${daySummary.newCustomers} / ${daySummary.newSellers} / ${daySummary.newRiders}`, hint: 'Customers / Sellers / Riders' },
                        ].map((item) => (
                            <div key={item.label} className="p-4 rounded-2xl bg-gray-50">
                                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">{item.label}</p>
                                <p className="text-xl font-bold text-gray-900 mt-1">{item.value}</p>
                                {item.hint && <p className="text-[10px] font-semibold text-gray-400 mt-1">{item.hint}</p>}
                            </div>
                        ))}
                    </div>
                    {daySummary.ordersByStatus.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {daySummary.ordersByStatus.map((s) => (
                                <Badge
                                    key={s.status}
                                    variant={STATUS_VARIANTS[s.status] || 'warning'}
                                    className="rounded-full px-3 py-1 text-[10px] font-bold tracking-tight uppercase"
                                >
                                    {s.status.replace(/_/g, ' ')}: {s.count}
                                </Badge>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            <div className="ds-grid-cards-3">
                {/* Revenue Analytics */}
                <div className="lg:col-span-2">
                    <Card
                        title="Earnings"
                        subtitle={isFiltered ? (isSingleDay ? `Hourly sales ${rangePhrase}` : `Daily sales ${rangePhrase}`) : "Daily revenue, last 30 days"}
                        className="h-full"
                    >
                        <div className="ds-chart-container min-h-[250px] min-w-0">
                            <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        dy={8}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                        tickFormatter={(value) => `₹${value}`}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`₹${value}`, "Revenue"]}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '8px',
                                            fontSize: '11px'
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#4f46e5"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRevenue)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Categories Distribution */}
                <div className="lg:col-span-1">
                    <Card
                        title="Top Categories"
                        subtitle="Sales breakdown by category"
                        className="h-full border-none shadow-sm ring-1 ring-gray-100"
                    >
                        <div className="h-[250px] min-h-[250px] min-w-0 relative">
                            <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={categoryData}

                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-bold text-gray-900">72%</span>
                                <span className="text-[10px] text-gray-400 font-semibold uppercase">Growth</span>
                            </div>
                        </div>
                        <div className="space-y-3 mt-4">
                            {categoryData.map((cat) => (
                                <div key={cat.name} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                        <span className="text-sm font-semibold text-gray-600">{cat.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">{cat.value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Orders */}
                <div className="lg:col-span-2">
                    <Card
                        title={isFiltered ? "Orders" : "Recent Orders"}
                        subtitle={isFiltered ? `Orders placed ${rangePhrase}` : "Track the latest customer orders"}
                        className="border-none shadow-sm ring-1 ring-gray-100 h-full"
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left border-b border-gray-100">
                                        <th className="admin-table-header">Order ID</th>
                                        <th className="admin-table-header">Customer</th>
                                        <th className="admin-table-header">Status</th>
                                        <th className="admin-table-header">Amount</th>
                                        <th className="admin-table-header">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} className="group hover:bg-gray-50/50 transition-all">
                                            <td className="py-4 text-sm font-semibold text-primary">{order.id}</td>
                                            <td className="py-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500 ring-2 ring-white shadow-sm uppercase">
                                                        {order.customer?.[0] || "?"}
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-700">{order.customer}</span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <Badge variant={order.status} className="rounded-full px-3 py-0.5 text-[10px] font-bold tracking-tight uppercase">
                                                    {order.statusText}
                                                </Badge>
                                            </td>
                                            <td className="py-4 text-sm font-bold text-gray-900">{order.amount}</td>
                                            <td className="py-4 text-xs font-semibold text-gray-400">{order.time}</td>
                                        </tr>
                                    ))}
                                    {recentOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-slate-300 italic text-xs">No orders for this period</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <button onClick={() => navigate('/admin/orders/all')} className="w-full mt-6 py-3 rounded-xl bg-gray-50 text-xs font-bold text-gray-500 hover:bg-primary hover:text-white transition-all">
                            VIEW ALL ORDERS
                        </button>
                    </Card>
                </div>

                {/* Top Products */}
                <div className="lg:col-span-1">
                    <Card
                        title="Top Products"
                        subtitle={isFiltered ? `Best sellers ${rangePhrase}` : "Best selling items overall"}
                        className="border-none shadow-sm ring-1 ring-gray-100 h-full"
                    >
                        <div className="space-y-4">
                            {topProducts.length > 0 ? topProducts.map((product, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group">
                                    <div className="flex items-center space-x-3">
                                        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform overflow-hidden", !product.image ? (product.color + " text-2xl") : "bg-gray-50")}>
                                            {product.image ? (
                                                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span>{product.icon}</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 leading-none">{product.name}</p>
                                            <p className="text-[10px] text-gray-400 font-semibold uppercase mt-1.5">{product.cat}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">{product.rev}</p>
                                        <p className="text-[10px] text-brand-600 font-bold">{product.trend}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-12 text-center text-slate-300 italic text-xs">No sales data yet</div>
                            )}
                        </div>
                        <button className="w-full mt-6 py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:border-primary hover:text-primary transition-all">
                            VIEW ALL PRODUCTS
                        </button>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

