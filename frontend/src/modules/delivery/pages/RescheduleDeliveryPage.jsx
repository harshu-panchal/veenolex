import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, Clock, AlertTriangle } from 'lucide-react';
import { deliveryApi } from '../services/deliveryApi';
import { toast } from 'sonner';

const RescheduleDeliveryPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [dates, setDates] = useState([]);
  const [isRescheduling, setIsRescheduling] = useState(false);

  useEffect(() => {
    // Generate next 7 days
    const next7Days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      next7Days.push(d);
    }
    setDates(next7Days);
    setSelectedDate(next7Days[0]);
  }, []);

  const getAvailableSlots = (date) => {
    if (!date) return [];
    
    // Exact operational hours: 9 AM to 9 PM, 2-hour slots
    const slots = [
      { start: 9, label: "9:00 AM - 11:00 AM" },
      { start: 11, label: "11:00 AM - 1:00 PM" },
      { start: 13, label: "1:00 PM - 3:00 PM" },
      { start: 15, label: "3:00 PM - 5:00 PM" },
      { start: 17, label: "5:00 PM - 7:00 PM" },
      { start: 19, label: "7:00 PM - 9:00 PM" },
    ];

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Filter out past slots if today
    return isToday ? slots.filter(slot => slot.start > now.getHours()) : slots;
  };

  const slots = getAvailableSlots(selectedDate);

  const handleReschedule = async () => {
    if (!selectedDate || !selectedSlot) return;
    
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(selectedSlot.start, 0, 0, 0);

    try {
      setIsRescheduling(true);
      const res = await deliveryApi.rescheduleOrder(orderId, scheduledDate.toISOString());
      if (res.data?.success) {
        toast.success("Delivery rescheduled successfully. Please return the items to the seller.");
        navigate('/delivery/dashboard');
      } else {
        toast.error(res.data?.message || "Failed to reschedule delivery");
      }
    } catch (e) {
      console.error("Reschedule API Error:", e);
      if (!e.response) {
        toast.error(`Network or unexpected error: ${e.message}`);
      } else {
        toast.error(e.response?.data?.message || "Failed to reschedule delivery");
      }
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Reschedule Delivery</h1>
        </div>
      </div>

      <div className="flex-1 p-4 pb-32 max-w-lg mx-auto w-full">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-bold text-orange-800 text-sm mb-1">Customer Unavailable?</h3>
            <p className="text-xs text-orange-700 leading-relaxed">
              If the customer cannot accept the delivery right now, you can reschedule it for another time. You will need to return the items to the seller/hub.
            </p>
          </div>
        </div>

        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-brand-600" />
          Select New Date
        </h3>
        
        <div className="flex overflow-x-auto pb-4 gap-3 hide-scrollbar -mx-4 px-4">
          {dates.map((date, idx) => {
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            return (
              <button
                key={idx}
                onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[72px] rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'border-black bg-black text-white shadow-sm shadow-gray-250'
                    : 'border-gray-150 bg-white text-gray-500 hover:border-gray-200'
                }`}
              >
                <span className="text-[10px] font-bold tracking-wider uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <h3 className="font-bold text-gray-800 mt-4 mb-3 flex items-center gap-2">
          <Clock size={18} className="text-gray-900" />
          Select Time Slot
        </h3>
        
        <div className="grid grid-cols-1 gap-3">
          {slots.length > 0 ? (
            slots.map((slot, idx) => {
              const isSelected = selectedSlot?.start === slot.start;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-4 rounded-xl border-2 text-left font-bold transition-all flex justify-between items-center ${
                    isSelected
                      ? 'border-black bg-gray-50 text-black'
                      : 'border-gray-150 bg-white text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {slot.label}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-black bg-white' : 'border-gray-300'
                  }`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black animate-scale-in" />}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center p-6 text-gray-500 bg-gray-100 rounded-2xl text-sm">
              No more slots available today.<br/>Please select another date.
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedSlot || isRescheduling}
            className="w-full h-14 bg-black  hover:bg-brand-700 text-white rounded-2xl font-bold uppercase tracking-wider disabled:bg-gray-300 disabled:text-gray-500 transition-all flex justify-center items-center gap-2"
          >
            {isRescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleDeliveryPage;
