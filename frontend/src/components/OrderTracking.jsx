import React from 'react';
import { Package, Truck, Phone, Store, Calendar, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const OrderTracking = ({ order, className }) => {
  if (!order) return null;

  const isShipRocket = order.deliveryType === "SHIPROCKET";

  // Fallbacks for nested seller population
  const seller = order.seller || order.sellerId || {};
  
  return (
    <div className={cn("bg-white p-5 rounded-2xl shadow-sm border border-slate-100", className)}>
      <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
        <Package className="text-primary" />
        Delivery Details
      </h3>

      {isShipRocket ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            <Truck className="text-blue-500 mt-1" size={20} />
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">
                Delivery Partner
              </p>
              <p className="font-semibold text-slate-800">ShipRocket (2-3 Business Days)</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {order.shipRocketDetails?.trackingNumber && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1">Tracking Number</p>
                <div className="flex flex-col items-start gap-2">
                  <p className="font-black text-slate-800 tracking-wide">
                    {order.shipRocketDetails.trackingNumber}
                  </p>
                  <a 
                    href={`https://shiprocket.co/tracking/${order.shipRocketDetails.trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Track on ShipRocket &rarr;
                  </a>
                </div>
              </div>
            )}

            {order.shipRocketDetails?.estimatedDelivery && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                  <Calendar size={14} /> Estimated Arrival
                </p>
                <p className="font-black text-slate-800 tracking-wide">
                  {new Date(order.shipRocketDetails.estimatedDelivery).toLocaleDateString(undefined, { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-green-50/50 rounded-xl border border-green-100">
            <MapPin className="text-green-600 mt-1" size={20} />
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-0.5">
                Delivery Partner
              </p>
              <p className="font-semibold text-slate-800">Fast Local Delivery</p>
              <p className="text-xs text-slate-500 mt-0.5">Seller will contact you shortly.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                <Store size={14} /> Store Name
              </p>
              <p className="font-bold text-slate-800">
                {seller.storeName || seller.name || "Local Store"}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1.5">
                <Phone size={14} /> Contact Number
              </p>
              <p className="font-bold text-slate-800">
                {seller.phone || seller.contactNumber || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTracking;
