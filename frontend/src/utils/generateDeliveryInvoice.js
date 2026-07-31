import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import logoUrl from '@/assets/Logo.png';

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
    const str = order.id || '';
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    const numericHash = (hash % 9000000000) + 1000000000;
    return String(numericHash);
};

// Helper: Get a dynamic routing code based on destination pincode and order ID hash
const getRoutingCode = (order) => {
    const address = order.address || '';
    const pinMatch = address.match(/\b\d{6}\b/);
    const pin = pinMatch ? pinMatch[0] : '';
    
    let hash = 0;
    const str = order.id || '';
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    const regions = ["MUM", "DEL", "BLR", "HYD", "KOL", "PNQ", "AHD", "MAA", "BZH", "MYU"];
    const region = regions[hash % regions.length];
    const pinPart = pin ? pin.substring(0, 3) : 'MYU';
    return `Routing Code: WB/${region}/${pinPart}`;
};

export const generateDeliveryInvoice = async (order) => {
    // Load logo first
    let logoBase64;
    try {
        logoBase64 = await loadImageAsBase64(logoUrl);
    } catch (e) {
        console.error('Failed to load logo:', e);
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
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(sanitizeText((order.customer.name || 'Unknown').toUpperCase()), margin + 2, margin + 9);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(sanitizeText(order.address || 'Address not provided'), 55);
    doc.text(addressLines, margin + 2, margin + 14);
    
    doc.setFont("helvetica", "italic");
    doc.text(`Phone No.: ${order.customer.phone || 'N/A'}`, margin + 2, margin + 14 + (addressLines.length * 3.5) + 2);

    // Veenolex Logo on right
    if (logoBase64) {
        // Reduced logo size slightly to fit better
        doc.addImage(logoBase64, 'PNG', pageWidth - margin - 26, margin + 2, 24, 15);
    } else {
        // Fallback to text if logo fails to load
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("VEENOLEX", pageWidth - margin - 2, margin + 15, { align: "right" });
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
    doc.text(order.payment === 'Cash on Delivery' ? 'COD' : 'PREPAID', statsValX, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 4.5;
    
    doc.text("ORDER TOTAL:", statsX, currentY);
    doc.setFont("helvetica", "bold");
    doc.text(`${order.total} INR`, statsValX, currentY);
    doc.setFont("helvetica", "normal");
    currentY += 4.5;
    
    doc.text("Weight:", statsX, currentY);
    doc.text("0.5 KG", statsValX, currentY); 
    currentY += 4.5;
    
    doc.text("eWaybill No.:", statsX, currentY);
    doc.text("N/A", statsValX, currentY);
    
    // Right column courier barcode
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Ecom Express Surface", pageWidth - margin - 2, mid1Y + 4, { align: "right" });
    
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
    doc.text("Veenolex Retail", margin + 2, mid2Y + 8);
    doc.setFont("helvetica", "normal");
    const sellerAddress = doc.splitTextToSize("123 Veenolex Hub, Main Market Road, Bhubaneswar, Odisha 751001", 45);
    doc.text(sellerAddress, margin + 2, mid2Y + 12);
    
    const sellerY = mid2Y + 12 + (sellerAddress.length * 3.5);
    doc.text("GSTIN: 21ABCDE1234F1Z5", margin + 2, sellerY);
    doc.text("Phone No.: 9876543210", margin + 2, sellerY + 3.5);
    
    // Order Barcode & details
    doc.setFontSize(6);
    // Split long order IDs into two lines to prevent overlapping
    if (order.id.length > 20) {
        doc.text(`Order #: ${order.id.substring(0, Math.floor(order.id.length / 2))}`, pageWidth - margin - 2, mid2Y + 4, { align: "right" });
        doc.text(`${order.id.substring(Math.floor(order.id.length / 2))}`, pageWidth - margin - 2, mid2Y + 6.5, { align: "right" });
    } else {
        doc.text(`Order #: ${order.id}`, pageWidth - margin - 2, mid2Y + 6, { align: "right" });
    }
    
    try {
        JsBarcode(canvas, order.id.substring(0, 15), {
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
    doc.text(`Invoice No.: Retail${order.id.slice(-6) || '000'}`, pageWidth - margin - 2, mid2Y + 24, { align: "right" });
    doc.text(`Invoice Date: ${order.date || new Date().toLocaleDateString()}`, pageWidth - margin - 2, mid2Y + 28, { align: "right" });

    // Table Section
    const tableStartY = mid2Y + mid2Height + 2;
    
    const tableData = (order.items || []).map(item => [
        `${item.name}\nSKU: VNLX-${item.name.substring(0,4).toUpperCase()}`,
        '123456', 
        item.qty.toString(),
        item.price.toFixed(2),
        (item.price * item.qty).toFixed(2),
        '0.00',
        (item.price * item.qty).toFixed(2)
    ]);
    
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
            halign: 'center'
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
    const tcText = "All disputes are subject to Veenolex jurisdiction only. Goods once sold will only be taken back or exchanged as per the store's exchange/return policy.";
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
    doc.text("Veenolex", pageWidth - margin - 2, pageHeight - margin - 3, { align: "right" });
    
    // Page numbering
    doc.setFontSize(8);
    doc.text("1/1", pageWidth/2, pageHeight - margin + 2, { align: "center" });

    // Save PDF
    doc.save(`invoice_${order.id || 'order'}.pdf`);
};
