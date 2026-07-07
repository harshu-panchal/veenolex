import React, { useState, useEffect } from 'react';

const ReschedulePicker = ({ isOpen, onClose, onSchedule, title = "Reschedule Delivery" }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [dates, setDates] = useState([]);

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

  const handleConfirm = () => {
    if (!selectedDate || !selectedSlot) return;
    
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(selectedSlot.start, 0, 0, 0);
    
    onSchedule(scheduledDate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
        
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <h3 className="font-medium text-sm text-gray-700 mb-2">Select Date</h3>
          <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
            {dates.map((date, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-lg border ${
                  selectedDate?.toDateString() === date.toDateString()
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-xs uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="text-lg font-bold">{date.getDate()}</span>
              </button>
            ))}
          </div>

          <h3 className="font-medium text-sm text-gray-700 mt-4 mb-2">Select Time Slot</h3>
          <div className="grid grid-cols-2 gap-2">
            {slots.length > 0 ? (
              slots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-2 text-sm rounded-lg border text-center ${
                    selectedSlot?.start === slot.start
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {slot.label}
                </button>
              ))
            ) : (
              <div className="col-span-2 text-center p-4 text-gray-500 bg-gray-50 rounded-lg">
                No more slots available today. Please select another date.
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedDate || !selectedSlot}
            className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReschedulePicker;
