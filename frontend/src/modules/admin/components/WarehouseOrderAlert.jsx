import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Check, X, MapPin, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@core/context/AuthContext';
import {
    getOrderSocket,
    onAdminOrderNew,
    onAdminOrderUpdated,
    onAdminOrderNoRider,
} from '@/core/services/orderSocket';
import orderAlertSound from '@/assets/sounds/order_alert.mp3';
import { adminApi } from '../services/adminApi';
import WarehouseDispatchModal from './WarehouseDispatchModal';

const POLL_INTERVAL_MS = 20000;

export const ROUTED_REASON_LABELS = {
    NO_LOCAL_SELLER: 'No local seller serves this area',
    LOCAL_SELLER_NO_STOCK: 'Local sellers are out of stock',
    SELLER_REJECTED: 'Local sellers rejected it',
    SELLER_TIMEOUT: 'Local sellers did not respond',
};

function toAlert(order) {
    if (!order?.orderId) return null;
    return {
        orderId: order.orderId,
        routedReason: order.routedReason,
        total: order.total ?? order.pricing?.total ?? order.paymentBreakdown?.grandTotal ?? 0,
        paymentMode: order.paymentMode,
        items: order.items || [],
        address: order.address || {},
        isReminder: Boolean(order.isReminder),
    };
}

/**
 * Admin counterpart of the seller's new-order popup: rings for orders the
 * warehouse must fulfil, then offers the dispatch options after accepting.
 */
const WarehouseOrderAlert = () => {
    const { token, user } = useAuth();
    const myAdminId = String(user?._id || user?.id || '');
    const [alert, setAlert] = useState(null);
    const [dispatchOrder, setDispatchOrder] = useState(null);
    const [busy, setBusy] = useState(false);
    const alertRef = useRef(null);
    const shownRef = useRef(new Set());
    const audioRef = useRef(null);

    useEffect(() => {
        alertRef.current = alert;
    }, [alert]);

    // Ringtone while the popup is open.
    useEffect(() => {
        if (!alert) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            return undefined;
        }
        if (!audioRef.current) {
            audioRef.current = new Audio(orderAlertSound);
            audioRef.current.loop = true;
        }
        const audio = audioRef.current;
        audio.play().catch(() => { });
        const retry = setInterval(() => {
            if (audio.paused) audio.play().catch(() => { });
        }, 1500);
        return () => clearInterval(retry);
    }, [alert]);

    useEffect(() => () => audioRef.current?.pause(), []);

    const showAlert = useCallback((order, { force = false } = {}) => {
        const next = toAlert(order);
        if (!next) return;
        if (alertRef.current) return;
        if (!force && shownRef.current.has(next.orderId)) return;
        shownRef.current.add(next.orderId);
        setAlert(next);
    }, []);

    // Polling fallback for missed socket events.
    const checkPending = useCallback(async () => {
        try {
            const res = await adminApi.getFulfillmentOrders({ tab: 'pending', limit: 5 });
            const items = res?.data?.result?.items || [];
            const next = items.find((o) => !shownRef.current.has(o.orderId));
            if (next) showAlert(next);
        } catch {
            /* ignore; socket is the primary path */
        }
    }, [showAlert]);

    useEffect(() => {
        if (!token) return undefined;
        const getToken = () => token;
        getOrderSocket(getToken);

        const offNew = onAdminOrderNew(getToken, (payload) => {
            showAlert(payload, { force: Boolean(payload?.isReminder) });
        });
        const offUpdated = onAdminOrderUpdated(getToken, (payload) => {
            if (!payload?.orderId) return;
            const handledElsewhere = payload.by && payload.by !== myAdminId;
            if (alertRef.current?.orderId === payload.orderId) {
                setAlert(null);
                if (handledElsewhere) toast.info(`Order #${payload.orderId} was handled by another admin`);
            }
            if (handledElsewhere) {
                setDispatchOrder((current) => (current?.orderId === payload.orderId ? null : current));
            }
        });
        const offNoRider = onAdminOrderNoRider(getToken, (payload) => {
            if (!payload?.orderId) return;
            toast.warning(`No rider accepted order #${payload.orderId}`);
            setDispatchOrder({ orderId: payload.orderId, noRiderFound: true });
        });

        checkPending();
        const timer = setInterval(checkPending, POLL_INTERVAL_MS);
        return () => {
            offNew();
            offUpdated();
            offNoRider();
            clearInterval(timer);
        };
    }, [token, myAdminId, showAlert, checkPending]);

    const handleAccept = async () => {
        if (!alert) return;
        setBusy(true);
        try {
            await adminApi.acceptFulfillmentOrder(alert.orderId);
            toast.success(`Order #${alert.orderId} accepted`);
            setDispatchOrder({ orderId: alert.orderId });
            setAlert(null);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to accept order');
            if (error?.response?.status === 409) setAlert(null);
        } finally {
            setBusy(false);
        }
    };

    const handleReject = async () => {
        if (!alert) return;
        if (!window.confirm(`Reject order #${alert.orderId}? The customer will be refunded.`)) return;
        setBusy(true);
        try {
            await adminApi.rejectFulfillmentOrder(alert.orderId, 'Not available in warehouse');
            toast.error(`Order #${alert.orderId} rejected`);
            setAlert(null);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to reject order');
            if (error?.response?.status === 409) setAlert(null);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {alert && (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                                    <BellRing className="h-10 w-10 text-primary" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 mb-2">
                                    {alert.isReminder ? 'Warehouse order still waiting' : 'New Warehouse Order!'}
                                </h2>
                                <p className="text-slate-600 font-medium mb-4">
                                    Order <span className="text-primary font-bold">#{alert.orderId}</span> for{' '}
                                    <span className="text-slate-900 font-bold">₹{alert.total}</span>
                                    {alert.paymentMode ? ` (${alert.paymentMode})` : ''}
                                </p>

                                {alert.routedReason && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold mb-4">
                                        <Warehouse className="h-4 w-4" />
                                        {ROUTED_REASON_LABELS[alert.routedReason] || alert.routedReason}
                                    </div>
                                )}

                                {alert.items.length > 0 && (
                                    <ul className="w-full text-left text-sm text-slate-700 mb-4 space-y-1 max-h-32 overflow-y-auto">
                                        {alert.items.map((item, index) => (
                                            <li key={index} className="flex justify-between gap-2">
                                                <span className="truncate">{item.name}</span>
                                                <span className="font-bold shrink-0">x{item.quantity}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {(alert.address.address || alert.address.city) && (
                                    <p className="flex items-start gap-2 text-xs text-slate-500 font-medium mb-6 text-left w-full">
                                        <MapPin className="h-4 w-4 shrink-0" />
                                        {[alert.address.address, alert.address.city].filter(Boolean).join(', ')}
                                    </p>
                                )}

                                <div className="grid grid-cols-2 gap-4 w-full">
                                    <button
                                        onClick={handleReject}
                                        disabled={busy}
                                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                                    >
                                        <X className="h-5 w-5" />
                                        Not available
                                    </button>
                                    <button
                                        onClick={handleAccept}
                                        disabled={busy}
                                        className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <Check className="h-5 w-5" />
                                        Accept
                                    </button>
                                </div>
                                <button
                                    onClick={() => setAlert(null)}
                                    className="mt-5 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider"
                                >
                                    Decide later (Warehouse Orders)
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {dispatchOrder && (
                    <WarehouseDispatchModal
                        order={dispatchOrder}
                        noRiderFound={Boolean(dispatchOrder.noRiderFound)}
                        onClose={() => setDispatchOrder(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default WarehouseOrderAlert;
