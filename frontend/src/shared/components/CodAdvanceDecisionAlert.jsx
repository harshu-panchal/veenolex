import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HandCoins, RotateCcw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@core/api/axios';
import { useAuth } from '@core/context/AuthContext';
import { onCodAdvanceDecided, onCodAdvanceDecision } from '@/core/services/orderSocket';
import orderAlertSound from '@/assets/sounds/order_alert.mp3';

const POLL_INTERVAL_MS = 60000;
// "Decide later" hides an order's popup for this long.
const SNOOZE_MS = 10 * 60 * 1000;

function toItem(row) {
    if (!row?.orderId) return null;
    const advance = row.codAdvance || {};
    return {
        orderId: row.orderId,
        amount: Number(row.amount ?? advance.amount ?? 0),
        status: row.status || advance.status || 'DECISION_PENDING',
        deadline: row.decisionDeadline || advance.decisionDeadline || null,
        cancelReason: row.cancelReason || '',
        refundFailureReason: row.refundFailureReason || advance.refundFailureReason || '',
    };
}

function formatDeadline(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * Seller/admin popup for a cancelled COD order whose customer already paid
 * the advance: Refund (back to the customer's payment method) or Keep.
 * Sellers see their own orders; admins see warehouse orders plus any refund
 * the gateway failed, which they can retry.
 */
const CodAdvanceDecisionAlert = ({ role }) => {
    const { token } = useAuth();
    const [queue, setQueue] = useState([]);
    const [busy, setBusy] = useState(false);
    const snoozedRef = useRef(new Map());
    const audioRef = useRef(null);

    const enqueue = useCallback((items) => {
        setQueue((current) => {
            const byId = new Map(current.map((item) => [item.orderId, item]));
            for (const item of items) {
                if (!item) continue;
                if (item.status === 'REFUND_FAILED' && role !== 'admin') continue;
                const snoozedUntil = snoozedRef.current.get(item.orderId) || 0;
                if (snoozedUntil > Date.now()) continue;
                byId.set(item.orderId, { ...byId.get(item.orderId), ...item });
            }
            return Array.from(byId.values());
        });
    }, [role]);

    const removeOrder = useCallback((orderId) => {
        setQueue((current) => current.filter((item) => item.orderId !== orderId));
    }, []);

    const fetchPending = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/orders/cod-advance/pending');
            const rows = Array.isArray(res?.data?.result) ? res.data.result : [];
            enqueue(rows.map(toItem));
        } catch {
            /* the socket is the primary path */
        }
    }, [enqueue]);

    useEffect(() => {
        if (!token) return undefined;
        const getToken = () => token;
        const offDecision = onCodAdvanceDecision(getToken, (payload) => {
            snoozedRef.current.delete(payload?.orderId);
            enqueue([toItem(payload)]);
        });
        const offDecided = onCodAdvanceDecided(getToken, (payload) => {
            if (payload?.orderId) removeOrder(payload.orderId);
        });
        fetchPending();
        const timer = setInterval(fetchPending, POLL_INTERVAL_MS);
        return () => {
            offDecision();
            offDecided();
            clearInterval(timer);
        };
    }, [token, enqueue, removeOrder, fetchPending]);

    const current = queue[0] || null;

    // One chime when a new decision appears.
    useEffect(() => {
        if (!current) return;
        if (!audioRef.current) audioRef.current = new Audio(orderAlertSound);
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => { });
    }, [current?.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => audioRef.current?.pause(), []);

    const decide = async (action) => {
        if (!current) return;
        setBusy(true);
        try {
            const res = await axiosInstance.post(`/orders/${current.orderId}/cod-advance/decision`, { action });
            toast.success(res?.data?.message || (action === 'REFUND' ? 'Refund sent' : 'Advance kept'));
            removeOrder(current.orderId);
        } catch (error) {
            const status = error?.response?.status;
            toast.error(error?.response?.data?.message || 'Could not save the decision');
            // Already decided elsewhere, or refund failed (admin can retry later).
            if (status === 409 || status === 403) removeOrder(current.orderId);
            if (status >= 500) fetchPending();
        } finally {
            setBusy(false);
        }
    };

    const snooze = () => {
        if (!current) return;
        snoozedRef.current.set(current.orderId, Date.now() + SNOOZE_MS);
        removeOrder(current.orderId);
    };

    // Only admins can retry a refund the gateway failed.
    const isRetry = current?.status === 'REFUND_FAILED';

    return (
        <AnimatePresence>
            {current && (
                <div className="fixed inset-0 z-[998] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mb-5">
                                <HandCoins className="h-8 w-8 text-amber-600" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-2">
                                {isRetry ? 'Advance refund failed' : 'Refund the COD advance?'}
                            </h2>
                            <p className="text-slate-600 font-medium mb-3">
                                Order <span className="text-primary font-bold">#{current.orderId}</span> was cancelled.
                                The customer paid <span className="text-slate-900 font-bold">₹{current.amount}</span> in advance.
                            </p>
                            {current.cancelReason && (
                                <p className="text-xs font-bold text-slate-500 mb-3">Reason: {current.cancelReason}</p>
                            )}
                            {isRetry ? (
                                current.refundFailureReason && (
                                    <p className="text-xs font-bold text-red-600 mb-3">{current.refundFailureReason}</p>
                                )
                            ) : (
                                current.deadline && (
                                    <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-3">
                                        Refunded automatically if not decided by {formatDeadline(current.deadline)}
                                    </p>
                                )
                            )}

                            <div className="grid grid-cols-2 gap-3 w-full mt-3">
                                {!isRetry && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => decide('KEEP')}
                                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black text-sm hover:bg-slate-200 disabled:opacity-60"
                                    >
                                        <Wallet className="h-4 w-4" /> Keep
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => decide('REFUND')}
                                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl bg-black text-white font-black text-sm hover:bg-slate-800 disabled:opacity-60 ${isRetry ? 'col-span-2' : ''}`}
                                >
                                    <RotateCcw className="h-4 w-4" /> {isRetry ? 'Retry refund' : 'Refund'}
                                </button>
                            </div>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={snooze}
                                className="mt-4 text-xs font-bold text-slate-400 hover:text-slate-600"
                            >
                                Decide later
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CodAdvanceDecisionAlert;
