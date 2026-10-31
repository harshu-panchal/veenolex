import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import defaultLogoUrl from '@/assets/Logo.png';
import { getWithDedupe } from '@core/api/dedupe';
import { DEFAULT_SETTINGS } from '@core/context/SettingsDefaults';

// Helper: load an image URL and return a base64 data URL
const loadImageAsBase64 = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = url;
    });
};

// Helper: Get tracking number dynamically or generate one deterministically
const getTrackingNumber = (order) => {
    if (order.shipRocketDetails?.trackingNumber && 
        order.shipRocketDetails.trackingNumber !== "Assigning...") {
        return order.shipRocketDetails.trackingNumber;
    }
    
    let hash = 0;
    const str = String(order.orderId || order.id || order._id || '');
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    const numericHash = (hash % 9000000000) + 1000000000;
    return String(numericHash);
};

// Helper: Get a dynamic routing code based on destination pincode and order ID hash
const getRoutingCode = (order) => {
    const address = typeof order.address === 'string'
        ? order.address
        : (order.deliveryAddress || order.address?.text || order.address?.fullAddress || [order.address?.street, order.address?.city, order.address?.state, order.address?.pincode].filter(Boolean).join(', ') || '');
    const pinMatch = address.match(/\b\d{6}\b/);
    const pin = pinMatch ? pinMatch[0] : '';
    
    let hash = 0;
    const str = String(order.orderId || order.id || order._id || '');
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    const regions = ["MUM", "DEL", "BLR", "HYD", "KOL", "PNQ", "AHD", "MAA", "BZH", "MYU"];
    const region = regions[hash % regions.length];
    const pinPart = pin ? pin.substring(0, 3) : 'MYU';
    return `Routing Code: WB/${region}/${pinPart}`;
};

export const generateDeliveryInvoice = async (order, customSettings = null) => {
    const orderId = String(order.orderId || order.id || order._id || '');

    // Resolve system settings dynamically
    let settings = customSettings;
    if (!settings || (!settings.companyName && !settings.address && !settings.supportPhone)) {
        try {
            const res = await getWithDedupe('/settings', {}, { ttl: 60 * 1000 });
            const data = res?.data?.result || res?.data;
            settings = { ...DEFAULT_SETTINGS, ...settings, ...data };
        } catch (e) {
            console.error('Failed to fetch settings for invoice:', e);
            settings = { ...DEFAULT_SETTINGS, ...settings };
        }
    } else {
        settings = { ...DEFAULT_SETTINGS, ...settings };
    }

    // Load logo (use dynamic settings.logoUrl if available, otherwise defaultLogoUrl)
    let logoBase64;
    const targetLogo = settings?.logoUrl || defaultLogoUrl;
    try {
        logoBase64 = await loadImageAsBase64(targetLogo);
    } catch (e) {
        if (targetLogo !== defaultLogoUrl) {
            try {
                logoBase64 = await loadImageAsBase64(defaultLogoUrl);
            } catch (fallbackErr) {
                console.error('Failed to load fallback logo:', fallbackErr);
            }
        } else {
            console.error('Failed to load logo:', e);
        }
    }

    // Standard shipping label size 4x6 inches = 101.6 x 152.4 mm
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [101.6, 152.4]
    });

    const pageWidth = 101.6;
    const pageHeight = 152.4;
    const margin = 4;
    
    // Set up basic styling
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    // Draw main border
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2*margin, pageHeight - 2*margin);

    // Helper to sanitize text for PDF (jsPDF default font doesn't support unicode like Hindi)
    const sanitizeText = (txt) => {
        if (!txt) return '';
        // Remove non-ASCII characters to prevent garbage text like '*@% *A0'
        return txt.replace(/[^\x00-\xFF]/g, '').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
    };

    // Header section: Ship To & Logo
    const headerHeight = 35;
    doc.line(margin, margin + headerHeight, pageWidth - margin, margin + headerHeight);
    
    // Ship To info
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Ship To", margin + 2, margin + 4);
    
    const customer = order.customer || {};
    const customerName = customer.name || order.customerName || order.shippingAddress?.name || 'Unknown';
    const customerPhone = customer.phone || order.phone || order.shippingAddress?.phone || order.address?.phone || 'N/A';
    const addressStr = typeof order.address === 'string'
        ? order.address
        : (order.deliveryAddress || order.address?.text || order.address?.fullAddress || [order.address?.street, order.address?.city, order.address?.state, order.address?.pincode].filter(Boolean).join(', ') || 'Address not provided');

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(sanitizeText(customerName.toUpperCase()), margin + 2, margin + 9);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(sanitizeText(addressStr), 55);
    doc.text(addressLines, margin + 2, margin + 14);
    
    doc.setFont("helvetica", "italic");
    doc.text(`Phone No.: ${customerPhone}`, margin + 2, margin + 14 + (addressLines.length * 3.5) + 2);

    // Logo on right
    if (logoBase64) {
        // Reduced logo size slightly to fit better
        doc.addImage(logoBase64, 'PNG', pageWidth - margin - 26, margin + 2, 24, 15);
    } else {
        // Fallback to text if logo fails to load
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        const headerBrand = sanitizeText(settings.appName || "VEENOLEX").toUpperCase();
        doc.text(headerBrand, pageWidth - margin - 2, margin + 14, { align: "right" });
    }
    
    // Middle section 1: Dimensions, payment etc.
    const mid1Height = 25;
    const mid1Y = margin + headerHeight;
    doc.line(margin, mid1Y + mid1Height, pageWidth - margin, mid1Y + mid1Height);
    
    // Left column stats
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const statsX = margin + 2;
    const statsValX = margin + 22;
    let currentY = mid1Y + 5;
    
    doc.text("Dimensions:", statsX, currentY);
    doc.text("15.00x5.00x1.00", statsValX, currentY);
    currentY += 4.5;
    
    doc.text("Payment:", statsX, currentY);
    doc.setFont("helvetica", "bold");
    const isCod = order.payment === 'Cash on Delivery' || 
                  order.payment?.method === 'cod' || 
                  order.payment?.method === 'cash' ||
                  order.paymentMethod === 'cod' ||
                  order.paymentMethod === 'cash';
    doc.text(isCod ? 'COD' : 'PREPAID', statsValX, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 4.5;
    
    doc.text("ORDER TOTAL:", statsX, currentY);
    doc.setFont("helvetica", "bold");
    const totalAmount = order.total ?? order.pricing?.total ?? order.amount ?? 0;
    doc.text(`${totalAmount} INR`, statsValX, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 4.5;
    
    doc.text("Weight:", statsX, currentY);
    doc.text("0.5 KG", statsValX, currentY); 
    currentY += 4.5;
    
    doc.text("eWaybill No.:", statsX, currentY);
    doc.text("N/A", statsValX, currentY);
    
    // Right column courier barcode
    const courierTitle = order.courierCompany || order.courierName || "";
    if (courierTitle && !courierTitle.toLowerCase().includes("ecom express")) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(courierTitle, pageWidth - margin - 2, mid1Y + 4, { align: "right" });
    }
    
    // Generate Courier barcode
    const canvas = document.createElement("canvas");
    try {
        JsBarcode(canvas, getTrackingNumber(order), { 
            format: "CODE128",
            displayValue: true,
            fontSize: 16,
            margin: 0,
            height: 45
        });
        const barcodeData = canvas.toDataURL("image/png");
        doc.addImage(barcodeData, 'PNG', pageWidth - margin - 40, mid1Y + 5, 38, 14);
    } catch (e) {
        console.error("Barcode generation failed", e);
    }
    
    doc.setFontSize(8);
    doc.text(getRoutingCode(order), pageWidth - margin - 2, mid1Y + 23, { align: "right" });

    // Middle section 2: Shipped By & Order Info
    const mid2Height = 35;
    const mid2Y = mid1Y + mid1Height;
    doc.line(margin, mid2Y + mid2Height, pageWidth - margin, mid2Y + mid2Height);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Shipped By (If undelivered, return to)", margin + 2, mid2Y + 4);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    const sellerCompany = sanitizeText(settings.companyName || settings.appName || "Veenolex Retail");
    doc.text(sellerCompany, margin + 2, mid2Y + 8);

    doc.setFont("helvetica", "normal");
    const sellerAddressText = sanitizeText(settings.address || "RIICO Industrial Area, Sagwara, Dungarpur, Rajasthan - 314025");
    const sellerAddress = doc.splitTextToSize(sellerAddressText, 45);
    doc.text(sellerAddress, margin + 2, mid2Y + 12);
    
    let sellerY = mid2Y + 12 + (sellerAddress.length * 3.5);
    const sellerTaxId = sanitizeText(settings.taxId || "21ABCDE1234F1Z5");
    if (sellerTaxId) {
        doc.text(`GSTIN: ${sellerTaxId}`, margin + 2, sellerY);
        sellerY += 3.5;
    }
    const sellerPhone = sanitizeText(settings.supportPhone || "9876543210");
    if (sellerPhone) {
        doc.text(`Phone No.: ${sellerPhone}`, margin + 2, sellerY);
    }
    
    // Order Barcode & details
    doc.setFontSize(6);
    // Split long order IDs into two lines to prevent overlapping
    if (orderId.length > 20) {
        doc.text(`Order #: ${orderId.substring(0, Math.floor(orderId.length / 2))}`, pageWidth - margin - 2, mid2Y + 4, { align: "right" });
        doc.text(`${orderId.substring(Math.floor(orderId.length / 2))}`, pageWidth - margin - 2, mid2Y + 6.5, { align: "right" });
    } else {
        doc.text(`Order #: ${orderId}`, pageWidth - margin - 2, mid2Y + 6, { align: "right" });
    }
    
    try {
        JsBarcode(canvas, orderId.substring(0, 15), {
            format: "CODE128",
            displayValue: false,
            margin: 0,
            height: 40
        });
        const orderBarcodeData = canvas.toDataURL("image/png");
        doc.addImage(orderBarcodeData, 'PNG', pageWidth - margin - 40, mid2Y + 8, 38, 12);
    } catch (e) {
        console.error("Order barcode generation failed", e);
    }
    
    doc.setFontSize(7.5);
    doc.text(`Invoice No.: Retail${orderId.slice(-6) || '000'}`, pageWidth - margin - 2, mid2Y + 24, { align: "right" });
    const invoiceDate = order.date || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
    doc.text(`Invoice Date: ${invoiceDate}`, pageWidth - margin - 2, mid2Y + 28, { align: "right" });

    // Table Section
    const tableStartY = mid2Y + mid2Height + 2;
    
    const tableData = (order.items || []).map(item => {
        const qty = Number(item.qty ?? item.quantity ?? 1);
        const price = Number(item.price || item.unitPrice || 0);
        const taxable = (price * qty).toFixed(2);
        const skuPrefix = (item.name || 'ITEM').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
        const sku = item.sku || `VNLX-${skuPrefix}`;
        const hsn = item.hsn || item.hsnCode || '123456';
        const igst = Number(item.igst || 0).toFixed(2);
        const total = (Number(taxable) + Number(igst)).toFixed(2);
        return [
            `${item.name}\nSKU: ${sku}`,
            hsn, 
            qty.toString(),
            price.toFixed(2),
            taxable,
            igst,
            total
        ];
    });
    
    autoTable(doc, {
        startY: tableStartY,
        head: [['Product Name & SKU', 'HSN', 'Qty', 'Unit\nPrice', 'Taxable\nValue', 'IGST', 'Total']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 6,
            cellPadding: 1,
            lineColor: [0, 0, 0],
            lineWidth: 0.2,
            textColor: [0, 0, 0]
        },
        headStyles: {
            fontStyle: 'bold',
            halign: 'center',
            fillColor: [32, 201, 151],
            textColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: 34 },
            1: { cellWidth: 10, halign: 'center' },
            2: { cellWidth: 6, halign: 'center' },
            3: { cellWidth: 11, halign: 'right' },
            4: { cellWidth: 12, halign: 'right' },
            5: { cellWidth: 8.6, halign: 'right' },
            6: { cellWidth: 12, halign: 'right' }
        },
        margin: { left: margin, right: margin }
    });

    const finalY = doc.lastAutoTable.finalY + 2;
    
    // T&C text
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const brandName = sanitizeText(settings.companyName || settings.appName || "Veenolex");
    const tcText = `All disputes are subject to ${brandName} jurisdiction only. Goods once sold will only be taken back or exchanged as per the store's exchange/return policy.`;
    const tcLines = doc.splitTextToSize(tcText, pageWidth - 2*margin);
    doc.text(tcLines, margin + 2, finalY);

    // Draw border for footer
    doc.line(margin, pageHeight - margin - 8, pageWidth - margin, pageHeight - margin - 8);

    // Footer text
    doc.setFontSize(5);
    doc.setFont("helvetica", "bold");
    doc.text("THIS IS AN AUTO-GENERATED LABEL AND DOES NOT NEED SIGNATURE.", margin + 2, pageHeight - margin - 4);
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Powered By:", pageWidth - margin - 2, pageHeight - margin - 6, { align: "right" });
    doc.setFont("helvetica", "bold");
    const appBrand = sanitizeText(settings.appName || "Veenolex");
    doc.text(appBrand, pageWidth - margin - 2, pageHeight - margin - 3, { align: "right" });
    
    // Page numbering
    doc.setFontSize(8);
    doc.text("1/1", pageWidth/2, pageHeight - margin + 2, { align: "center" });

    // Save PDF
    doc.save(`invoice_${orderId || 'order'}.pdf`);
};
