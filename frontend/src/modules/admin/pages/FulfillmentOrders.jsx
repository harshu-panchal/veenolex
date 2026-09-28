import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Warehouse, Truck, Check, X, Settings2, MapPin, RefreshCw, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import Card from '@shared/components/ui/Card';
import Pagination from '@shared/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { useAuth } from '@core/context/AuthContext';
import { onAdminOrderNew, onAdminOrderUpdated } from '@/core/services/orderSocket';
import { adminApi } from '../services/adminApi';
import WarehouseDispatchModal from '../components/WarehouseDispatchModal';
import { ROUTED_REASON_LABELS } from '../components/WarehouseOrderAlert';
import { formatArrivalText } from '@shared/utils/deliveryTime';

const TABS = [
    { key: 'pending', label: 'Waiting for you' },
    { key: 'accepted', label: 'Accepted — dispatch' },
    { key: 'dispatched', label: 'Out for delivery' },
    { key: 'completed', label: 'Completed' },
];

const STATUS_LABELS = {
    SELLER_PENDING: 'Waiting',
    SELLER_ACCEPTED: 'Accepted',
    DELIVERY_SEARCH: 'Finding rider',
    DELIVERY_ASSIGNED: 'Rider assigned',
    PICKUP_READY: 'Rider at warehouse',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
};

const WAREHOUSE_FIELDS = [
    { key: 'name', label: 'Warehouse name' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address', wide: true },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'Pincode' },
    { key: 'lat', label: 'Latitude', type: 'number' },
    { key: 'lng', label: 'Longitude', type: 'number' },
    { key: 'serviceRadiusKm', label: 'Rider radius (km)', type: 'number' },
    { key: 'shiprocketPickupLocation', label: 'Shiprocket pickup name' },
    { key: 'adminAcceptTimeoutMinutes', label: 'Reminder every (minutes)', type: 'number' },
    { key: 'localDeliveryMaxHours', label: 'Rider delivery within (hours)', type: 'number' },
    { key: 'standardDeliveryDaysMin', label: 'Courier delivery min (days)', type: 'number' },
    { key: 'standardDeliveryDaysMax', label: 'Courier delivery max (days)', type: 'number' },
    { key: 'packageWeightKg', label: 'Parcel weight for courier (kg)', type: 'number' },
];

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function DeliveryInfo({ order }) {
    if (order.deliveryType === 'SHIPROCKET') {
        const sr = order.shipRocketDetails || {};
        return (
            <div className="text-xs">
                <p className="font-bold text-amber-700">Shiprocket · {sr.status || 'PENDING'}</p>
                {sr.trackingNumber && <p className="text-slate-500">AWB: {sr.trackingNumber}</p>}
            </div>
        );
    }
    if (order.deliveryBoy) {
        return (
            <div className="text-xs">
                <p className="font-bold text-slate-800">{order.deliveryBoy.name || 'Rider'}</p>
                <p className="text-slate-500">{order.deliveryBoy.phone}</p>
            </div>
        );
    }
    return <span className="text-xs text-slate-400">—</span>;
}

function RoutingTrail({ order }) {
    const tried = (order.routingHistory || []).filter((h) => h.outcome === 'REJECTED' || h.outcome === 'TIMEOUT');
    return (
        <div className="text-xs space-y-1">
            <p className="font-bold text-amber-700">
                {ROUTED_REASON_LABELS[order.routedReason] || 'Warehouse order'}
            </p>
            {tried.map((entry, index) => (
                <p key={index} className="text-slate-500">
                    {entry.seller?.shopName || 'Seller'}: {entry.outcome === 'TIMEOUT' ? 'no response' : 'not available'}
                </p>
            ))}
        </div>
    );
}

function WarehouseSettings() {
    const [form, setForm] = useState({});
    const [resolved, setResolved] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        adminApi
            .getWarehouseSettings()
            .then((res) => {
                const result = res?.data?.result || {};
                setForm(result.configured || {});
                setResolved(result.resolved || null);
            })
            .catch(() => toast.error('Could not load warehouse settings'));
    }, []);

    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const res = await adminApi.updateWarehouseSettings(form);
            setForm(res?.data?.result?.configured || form);
            setResolved(res?.data?.result?.resolved || null);
            toast.success('Warehouse settings saved');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
            <form onSubmit={save} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {WAREHOUSE_FIELDS.map((field) => (
                        <label key={field.key} className={cn('block', field.wide && 'md:col-span-2')}>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.label}</span>
                            <input
                                type={field.type || 'text'}
                                step="any"
                                value={form[field.key] ?? ''}
                                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                className="mt-1 w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </label>
                    ))}
                </div>
                {resolved && (
                    <p className={cn('text-xs font-bold', resolved.hasLocation ? 'text-slate-500' : 'text-rose-600')}>
                        <MapPin className="inline h-3.5 w-3.5 mr-1" />
                        {resolved.hasLocation
                            ? `Riders are dispatched from ${resolved.lat}, ${resolved.lng}${form.lat ? '' : ' (from your admin profile location)'}`
                            : 'No warehouse location set — rider broadcast will not work until latitude/longitude are filled.'}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save warehouse'}
                </button>
            </form>
        </Card>
    );
}

const FulfillmentOrders = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [tab, setTab] = useState('pending');
    const [orders, setOrders] = useState([]);
    const [counts, setCounts] = useState({});
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState(null);
    const [dispatchOrder, setDispatchOrder] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const pageSize = 20;

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getFulfillmentOrders({ tab, page, limit: pageSize });
            const result = res?.data?.result || {};
            setOrders(result.items || []);
            setCounts(result.counts || {});
            setTotal(result.total || 0);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to load warehouse orders');
        } finally {
            setLoading(false);
        }
    }, [tab, page]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    useEffect(() => {
        if (!token) return undefined;
        const getToken = () => token;
        const offNew = onAdminOrderNew(getToken, () => fetchOrders());
        const offUpdated = onAdminOrderUpdated(getToken, () => fetchOrders());
        return () => {
            offNew();
            offUpdated();
        };
    }, [token, fetchOrders]);

    const accept = async (orderId) => {
        setActionId(orderId);
        try {
            await adminApi.acceptFulfillmentOrder(orderId);
            toast.success(`Order #${orderId} accepted`);
            setDispatchOrder({ orderId });
            fetchOrders();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to accept');
        } finally {
            setActionId(null);
        }
    };

    const reject = async (orderId) => {
        if (!window.confirm(`Reject order #${orderId}? The customer will be refunded.`)) return;
        setActionId(orderId);
        try {
            await adminApi.rejectFulfillmentOrder(orderId, 'Not available in warehouse');
            toast.success(`Order #${orderId} rejected`);
            fetchOrders();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to reject');
        } finally {
            setActionId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        <Warehouse className="h-7 w-7 text-primary" />
                        Warehouse Orders
                    </h1>
                    <p className="ds-description mt-1">
                        Orders no local seller could fulfil. Accept them, then send a rider or ship via Shiprocket.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchOrders}
                        className="flex items-center gap-2 px-4 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50"
                    >
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </button>
                    <button
                        onClick={() => setShowSettings((v) => !v)}
                        className="flex items-center gap-2 px-4 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50"
                    >
                        <Settings2 className="h-4 w-4" /> Warehouse settings
                    </button>
                </div>
            </div>

            {showSettings && <WarehouseSettings />}

            <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => {
                            setTab(t.key);
                            setPage(1);
                        }}
                        className={cn(
                            'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                            tab === t.key ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50',
                        )}
                    >
                        {t.label}
                        {counts[t.key] > 0 && (
                            <span className={cn('ml-2 px-2 py-0.5 rounded-full', t.key === 'pending' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-700')}>
                                {counts[t.key]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <Card className="border-none shadow-2xl ring-1 ring-slate-100/50 bg-white rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                {['Order', 'Customer', 'Items', 'Why here', 'Status', 'Delivery', 'Action'].map((h) => (
                                    <th key={h} className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-16 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        Loading…
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-16 text-center text-sm font-bold text-slate-400">
                                        Nothing here right now.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const canDispatch =
                                        order.workflowStatus === 'SELLER_ACCEPTED' ||
                                        (order.workflowStatus === 'DELIVERY_SEARCH' && !order.deliveryBoy);
                                    return (
                                        <tr key={order._id || order.orderId} className="align-top hover:bg-slate-50/30">
                                            <td className="px-4 py-4">
                                                <button
                                                    onClick={() => navigate(`/admin/orders/view/${order.orderId}`)}
                                                    className="text-sm font-black text-slate-900 hover:text-primary"
                                                >
                                                    #{order.orderId}
                                                </button>
                                                <p className="text-xs text-slate-400">{formatDate(order.createdAt)}</p>
                                                <p className="text-xs font-bold text-slate-700 mt-1">
                                                    ₹{order.pricing?.total ?? order.paymentBreakdown?.grandTotal ?? 0} · {order.paymentMode}
                                                </p>
                                            </td>
                                            <td className="px-4 py-4 text-xs">
                                                <p className="font-bold text-slate-800">{order.customer?.name || order.address?.name}</p>
                                                <p className="text-slate-500">{order.address?.phone || order.customer?.phone}</p>
                                                <p className="text-slate-500">{[order.address?.city, order.address?.pincode].filter(Boolean).join(' ')}</p>
                                            </td>
                                            <td className="px-4 py-4 text-xs text-slate-700">
                                                {(order.items || []).map((item, i) => (
                                                    <p key={i}>{item.name} × {item.quantity}</p>
                                                ))}
                                            </td>
                                            <td className="px-4 py-4"><RoutingTrail order={order} /></td>
                                            <td className="px-4 py-4">
                                                <span className="text-xs font-black text-slate-700">
                                                    {STATUS_LABELS[order.workflowStatus] || order.workflowStatus}
                                                </span>
                                                {formatArrivalText(order.deliveryEta) && !['DELIVERED', 'CANCELLED'].includes(order.workflowStatus) && (
                                                    <p className="text-[10px] font-bold text-slate-500">Customer sees: {formatArrivalText(order.deliveryEta)}</p>
                                                )}
                                                {order.adminReminderCount > 0 && order.workflowStatus === 'SELLER_PENDING' && (
                                                    <p className="text-[10px] font-bold text-rose-500">Reminded {order.adminReminderCount}×</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4"><DeliveryInfo order={order} /></td>
                                            <td className="px-4 py-4">
                                                {order.workflowStatus === 'SELLER_PENDING' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => reject(order.orderId)}
                                                            disabled={actionId === order.orderId}
                                                            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                                                            title="Not available — cancel & refund"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => accept(order.orderId)}
                                                            disabled={actionId === order.orderId}
                                                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-black disabled:opacity-50"
                                                        >
                                                            <Check className="h-4 w-4" /> Accept
                                                        </button>
                                                    </div>
                                                )}
                                                {canDispatch && order.deliveryType !== 'SHIPROCKET' && (
                                                    <button
                                                        onClick={() => setDispatchOrder({ orderId: order.orderId })}
                                                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black"
                                                    >
                                                        <Truck className="h-4 w-4" /> Dispatch
                                                    </button>
                                                )}
                                                {order.shipRocketDetails?.status === 'SHIPMENT_FAILED' && (
                                                    <button
                                                        onClick={() => setDispatchOrder({ orderId: order.orderId })}
                                                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-black"
                                                    >
                                                        <PackageCheck className="h-4 w-4" /> Retry dispatch
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {total > pageSize && (
                    <div className="p-4 border-t border-slate-50">
                        <Pagination
                            page={page}
                            totalPages={Math.ceil(total / pageSize) || 1}
                            total={total}
                            pageSize={pageSize}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>

            <AnimatePresence>
                {dispatchOrder && (
                    <WarehouseDispatchModal
                        order={dispatchOrder}
                        onClose={() => setDispatchOrder(null)}
                        onDispatched={() => fetchOrders()}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default FulfillmentOrders;
