import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, Radio, UserCheck, PackageCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';

/**
 * Dispatch options for an accepted warehouse order:
 * broadcast to nearby riders, assign a specific rider, or ship via Shiprocket.
 */
const WarehouseDispatchModal = ({ order, onClose, onDispatched, noRiderFound = false }) => {
    const [drivers, setDrivers] = useState([]);
    const [loadingDrivers, setLoadingDrivers] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [busyMode, setBusyMode] = useState(null);

    useEffect(() => {
        if (!order) return;
        let cancelled = false;
        setLoadingDrivers(true);
        adminApi
            .getDeliveryPartners({ verified: 'true', limit: 200 })
            .then((res) => {
                const payload = res?.data?.result || {};
                const list = Array.isArray(payload.items)
                    ? payload.items
                    : res?.data?.results || (Array.isArray(payload) ? payload : []);
                if (!cancelled) setDrivers(Array.isArray(list) ? list : []);
            })
            .catch(() => {
                if (!cancelled) toast.error('Could not load delivery partners');
            })
            .finally(() => {
                if (!cancelled) setLoadingDrivers(false);
            });
        return () => {
            cancelled = true;
        };
    }, [order?.orderId]);

    if (!order) return null;

    const dispatch = async (mode, extra = {}) => {
        setBusyMode(mode);
        try {
            const res = await adminApi.dispatchFulfillmentOrder(order.orderId, { mode, ...extra });
            toast.success(res?.data?.message || 'Order dispatched');
            onDispatched?.(order.orderId, mode);
            onClose?.();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Dispatch failed');
        } finally {
            setBusyMode(null);
        }
    };

    const optionClass =
        'w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-3 text-left disabled:opacity-50';

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100"
            >
                <div className="flex flex-col items-center text-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
                        <Truck className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">Dispatch from Warehouse</h2>
                    <p className="text-slate-600 text-xs sm:text-sm font-medium mb-6">
                        {noRiderFound
                            ? 'No rider accepted the broadcast. Assign someone or ship it via Shiprocket.'
                            : 'Choose how order '}
                        {!noRiderFound && <span className="text-primary font-bold">#{order.orderId}</span>}
                        {!noRiderFound && ' should be delivered:'}
                    </p>

                    <div className="space-y-4 w-full">
                        <button
                            onClick={() => dispatch('BROADCAST')}
                            disabled={Boolean(busyMode)}
                            className={`${optionClass} border-primary/20 bg-primary/5 hover:bg-primary/10`}
                        >
                            <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                                {busyMode === 'BROADCAST' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-900">Broadcast to riders</h4>
                                <p className="text-xs text-slate-500 font-medium">Alert all active riders near the warehouse</p>
                            </div>
                        </button>

                        <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-3 text-left">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                                    <UserCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900">Assign a driver</h4>
                                    <p className="text-xs text-slate-500 font-medium">Pick a specific delivery partner</p>
                                </div>
                            </div>
                            <select
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                disabled={loadingDrivers}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="">
                                    {loadingDrivers ? 'Loading drivers…' : '-- Select delivery partner --'}
                                </option>
                                {drivers.map((driver) => (
                                    <option key={driver._id || driver.id} value={driver._id || driver.id}>
                                        {driver.name || 'Unnamed'} ({driver.phone || 'no phone'}) - {driver.isOnline ? 'Online' : 'Offline'}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => dispatch('MANUAL', { deliveryBoyId: selectedDriverId })}
                                disabled={!selectedDriverId || Boolean(busyMode)}
                                className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 hover:bg-slate-800 transition-all"
                            >
                                {busyMode === 'MANUAL' ? 'Assigning…' : 'Confirm driver'}
                            </button>
                        </div>

                        <button
                            onClick={() => dispatch('SHIPROCKET')}
                            disabled={Boolean(busyMode)}
                            className={`${optionClass} border-amber-200 bg-amber-50 hover:bg-amber-100`}
                        >
                            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                {busyMode === 'SHIPROCKET' ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-900">Ship via Shiprocket</h4>
                                <p className="text-xs text-slate-500 font-medium">Courier pickup from the warehouse (1-3 days)</p>
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
                    >
                        Dispatch later
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default WarehouseDispatchModal;
