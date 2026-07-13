import React, { useState } from 'react';
import { X, Printer, Download, Share2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@core/context/SettingsContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const InvoiceModal = ({ isOpen, onClose, order }) => {
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const primaryColor = settings?.primaryColor || 'var(--primary)';
    const [isSaving, setIsSaving] = useState(false);

    if (!order) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleSavePDF = async () => {
        let styleOverride = null;
        try {
            setIsSaving(true);
            const element = document.getElementById("printable-invoice");
            if (!element) return;

            // Inject the style override in the main/live document head temporarily
            styleOverride = document.createElement("style");
            styleOverride.id = "html2canvas-oklch-override";
            styleOverride.innerHTML = `
                :root, [data-theme], body, #printable-invoice, #printable-invoice * {
                    --primary: #4f46e5 !important;
                    --color-primary: #4f46e5 !important;
                    --color-slate-50: #f8fafc !important;
                    --color-slate-100: #f1f5f9 !important;
                    --color-slate-200: #e2e8f0 !important;
                    --color-slate-300: #cbd5e1 !important;
                    --color-slate-400: #94a3b8 !important;
                    --color-slate-500: #64748b !important;
                    --color-slate-600: #475569 !important;
                    --color-slate-700: #334155 !important;
                    --color-slate-800: #1e293b !important;
                    --color-slate-900: #0f172a !important;
                    
                    --color-blue-50: #eff6ff !important;
                    --color-blue-100: #dbeafe !important;
                    --color-blue-200: #bfdbfe !important;
                    --color-blue-500: #3b82f6 !important;
                    --color-blue-600: #2563eb !important;
                    
                    --color-indigo-50: #eef2ff !important;
                    --color-indigo-100: #e0e7ff !important;
                    --color-indigo-200: #c7d2fe !important;
                    --color-indigo-700: #4338ca !important;
                    --color-indigo-950: #1e1b4b !important;
                    
                    --color-brand-50: #eff6ff !important;
                    --color-brand-100: #dbeafe !important;
                    --color-brand-600: #2563eb !important;
                    
                    --color-gray-50: #f9fafb !important;
                    --color-gray-100: #f3f4f6 !important;
                    --color-gray-200: #e5e7eb !important;
                    --color-gray-500: #9ca3af !important;
                    --color-gray-600: #4b5563 !important;
                    --color-gray-800: #1f2937 !important;
                }
            `;
            document.head.appendChild(styleOverride);

            // Wait a paint cycle for the browser to recalculate computed styles to RGB
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await new Promise((resolve) => setTimeout(resolve, 50));

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
            });

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`invoice_${order.id}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            if (styleOverride && styleOverride.parentNode) {
                styleOverride.parentNode.removeChild(styleOverride);
            }
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
                        >
                            {/* Header */}
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800">Invoice</h2>
                                    <p className="text-xs text-slate-500 font-medium">#{order.id}</p>
                                </div>
                                <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-slate-200 transition-colors shadow-sm border border-slate-100">
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>

                            {/* Printable Area */}
                            <div className="p-8 space-y-6" id="printable-invoice">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-2xl font-black tracking-tight" style={{ color: primaryColor }}>{appName}</h1>
                                        <p className="text-xs text-slate-500 mt-1">{settings?.companyName || 'Quick Commerce'}<br />{settings?.address || '—'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-800">Bill To:</p>
                                        <p className="text-xs text-slate-500 mt-1">{order.address?.name || 'Customer'}<br />{order.address?.phone || ''}</p>
                                    </div>
                                </div>

                                <div className="border rounded-xl overflow-hidden border-slate-100">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                            <tr>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3 text-right">Qty</th>
                                                <th className="px-4 py-3 text-right">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {order.items?.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3 text-slate-700 font-medium">{item.name || item.product?.name}</td>
                                                    <td className="px-4 py-3 text-slate-500 text-right">{item.quantity}</td>
                                                    <td className="px-4 py-3 text-slate-800 font-bold text-right">₹{item.price}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <div className="flex justify-between text-sm text-slate-500">
                                        <span>Subtotal</span>
                                        <span>₹{order.pricing?.subtotal ?? 0}</span>
                                    </div>
                                    {order.pricing?.deliveryFee > 0 && (
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>Delivery Fee</span>
                                            <span>₹{order.pricing.deliveryFee}</span>
                                        </div>
                                    )}
                                    {order.pricing?.platformFee > 0 && (
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>Platform Fee</span>
                                            <span>₹{order.pricing.platformFee}</span>
                                        </div>
                                    )}
                                    {order.pricing?.gst > 0 && (
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>Tax/GST</span>
                                            <span>₹{order.pricing.gst}</span>
                                        </div>
                                    )}
                                    {order.pricing?.tip > 0 && (
                                        <div className="flex justify-between text-sm text-slate-500">
                                            <span>Tip</span>
                                            <span>₹{order.pricing.tip}</span>
                                        </div>
                                    )}
                                    {order.pricing?.discount > 0 && (
                                        <div className="flex justify-between text-sm text-brand-600 font-medium">
                                            <span>Discount</span>
                                            <span>-₹{order.pricing.discount}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-base font-black text-slate-800 pt-2 border-t border-slate-100">
                                        <span>Total Paid</span>
                                        <span>₹{order.pricing?.total ?? 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                             <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                                 <button onClick={handlePrint} className="flex-1 py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg" style={{ backgroundColor: primaryColor }}>
                                     <Printer size={18} /> Print
                                 </button>
                                 <button 
                                     onClick={handleSavePDF} 
                                     disabled={isSaving}
                                     className="flex-1 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     {isSaving ? (
                                         <>
                                             <Loader2 size={18} className="animate-spin" /> Saving...
                                         </>
                                     ) : (
                                         <>
                                             <Download size={18} /> Save PDF
                                         </>
                                     )}
                                 </button>
                             </div>

                             <style>
                                 {`
                                     @media print {
                                         /* Hide all other elements */
                                         body * {
                                             visibility: hidden !important;
                                         }
                                         /* Show only invoice card content */
                                         #printable-invoice, #printable-invoice * {
                                             visibility: visible !important;
                                         }
                                         /* Reset absolute transforms, backgrounds, and shadows that block print layout */
                                         .fixed, .absolute, [style*="transform"], div, section, main, header, footer {
                                             position: static !important;
                                             transform: none !important;
                                             box-shadow: none !important;
                                             backdrop-filter: none !important;
                                             background: none !important;
                                         }
                                         #printable-invoice {
                                             position: absolute !important;
                                             left: 0 !important;
                                             top: 0 !important;
                                             width: 100% !important;
                                             padding: 20px !important;
                                             margin: 0 !important;
                                             background-color: white !important;
                                             box-sizing: border-box !important;
                                         }
                                     }
                                 `}
                             </style>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default InvoiceModal;

