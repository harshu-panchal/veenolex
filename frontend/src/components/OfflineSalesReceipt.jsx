import React, { useRef, useState } from "react";
import { formatSaleDate, formatCurrency } from "../services/offlineSalesService";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export const OfflineSalesReceipt = ({ sale, sellerInfo = null, onClose = null }) => {
  const [showShareOptions, setShowShareOptions] = useState(false);
  // ═══════════════════════════════════════════════════════════════
  // HANDLE PRINT
  // ═══════════════════════════════════════════════════════════════
  const handlePrint = () => {
    console.log("🖨️ Printing receipt...");
    window.print();
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLE SHARE PDF
  // ═══════════════════════════════════════════════════════════════
  const receiptRef = useRef(null);

  const handleShareReceiptPDF = async () => {
    setShowShareOptions(false);
    try {
      console.log("📤 Generating PDF for sharing...");
      
      const element = receiptRef.current;
      if (!element) return;

      // Capture DOM element as canvas
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Calculate dimensions to fit width
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, pdfHeight);

      const receiptId = sale._id || sale.saleId || "receipt";
      const filename = `Receipt-${receiptId.toString().slice(-8).toUpperCase()}.pdf`;

      // Convert PDF to blob & file object for sharing
      const pdfBlob = pdf.output("blob");
      const file = new File([pdfBlob], filename, { type: "application/pdf" });

      // Check if sharing files is supported
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Receipt #${receiptId.toString().slice(-8).toUpperCase()}`,
          text: `Here is the receipt for ${sale.customerName}`
        });
        console.log("✅ Receipt shared successfully!");
      } else {
        // Fallback to downloading PDF if Web Share is unsupported
        pdf.save(filename);
        alert("Sharing is not supported on this device/browser. The PDF receipt has been downloaded instead.");
      }
      
    } catch (error) {
      console.error("❌ Error sharing receipt:", error);
      alert("Failed to share PDF receipt. Please try printing instead.");
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLE WHATSAPP SHARE
  // ═══════════════════════════════════════════════════════════════
  const handleWhatsAppShare = () => {
    setShowShareOptions(false);
    const receiptId = sale._id || sale.saleId || "receipt";
    const cleanPhone = sale.customerPhone ? sale.customerPhone.replace(/\D/g, "") : "";
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    // Generate text summary
    let itemsText = "";
    if (sale.items && Array.isArray(sale.items)) {
      itemsText = sale.items.map(item => `• ${item.productName} (x${item.quantity}) - ${formatCurrency(item.subTotal)}`).join("\n");
    }

    const text = `🧾 *RECEIPT SUMMARY*\n\n` +
      `*Receipt ID:* ${receiptId.toString().slice(-8).toUpperCase()}\n` +
      `*Seller:* ${sale.sellerName}\n` +
      `*Customer:* ${sale.customerName}\n\n` +
      `*Items Bought:*\n${itemsText}\n\n` +
      `*Grand Total:* ${formatCurrency(sale.totalAmount)}\n` +
      `*Payment Method:* ${sale.paymentMethod || "CASH"}\n\n` +
      `Thank you for shopping with us!`;

    const url = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  // ═══════════════════════════════════════════════════════════════
  // HANDLE EMAIL SHARE
  // ═══════════════════════════════════════════════════════════════
  const handleEmailShare = () => {
    setShowShareOptions(false);
    const receiptId = sale._id || sale.saleId || "receipt";
    
    let itemsText = "";
    if (sale.items && Array.isArray(sale.items)) {
      itemsText = sale.items.map(item => `- ${item.productName} (x${item.quantity}): ${formatCurrency(item.subTotal)}`).join("\n");
    }

    const subject = `Receipt for Sale ${receiptId.toString().slice(-8).toUpperCase()}`;
    const body = `🧾 RECEIPT SUMMARY\n\n` +
      `Receipt ID: ${receiptId.toString().slice(-8).toUpperCase()}\n` +
      `Seller: ${sale.sellerName}\n` +
      `Customer: ${sale.customerName}\n\n` +
      `Items Bought:\n${itemsText}\n\n` +
      `Grand Total: ${formatCurrency(sale.totalAmount)}\n` +
      `Payment Method: ${sale.paymentMethod || "CASH"}\n\n` +
      `Thank you for shopping with us!`;

    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_self");
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  const receiptId = sale._id || sale.saleId || "UNKNOWN";
  
  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: "12px",
      border: "1px solid #e0e0e0",
      padding: "20px"
    }}>

      {/* ACTION BUTTONS (Moved to top for visibility) */}
      <div className="no-print" style={{
        display: "flex",
        gap: "12px",
        marginBottom: "20px",
        justifyContent: "center",
        flexWrap: "wrap"
      }}>
        <button
          onClick={handlePrint}
          style={{
            padding: "10px 16px",
            backgroundColor: "#3B9FD9",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "600",
            transition: "all 0.3s ease"
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "#2E7FA8"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#3B9FD9"}
        >
          🖨️ Print Receipt
        </button>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowShareOptions(!showShareOptions)}
            style={{
              padding: "10px 16px",
              backgroundColor: "#27AE60",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#219653"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#27AE60"}
          >
            📤 Share Receipt
          </button>
          
          {showShareOptions && (
            <div style={{
              position: "absolute",
              top: "45px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 10,
              width: "220px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}>
              <button
                onClick={handleShareReceiptPDF}
                style={{
                  padding: "12px",
                  border: "none",
                  backgroundColor: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#f5f5f5"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
              >
                📱 Share PDF (WhatsApp/Mail File)
              </button>
              <button
                onClick={handleWhatsAppShare}
                style={{
                  padding: "12px",
                  border: "none",
                  borderTop: "1px solid #eee",
                  backgroundColor: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#27AE60",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#f5f5f5"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
              >
                💬 Share Summary on WhatsApp
              </button>
              <button
                onClick={handleEmailShare}
                style={{
                  padding: "12px",
                  border: "none",
                  borderTop: "1px solid #eee",
                  backgroundColor: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#2D88FF",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#f5f5f5"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
              >
                ✉️ Share Summary via Email
              </button>
            </div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: "10px 16px",
              backgroundColor: "#f0f0f0",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = "#e0e0e0"}
            onMouseLeave={(e) => e.target.style.backgroundColor = "#f0f0f0"}
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* RECEIPT CONTENT */}
      <div
        id="receipt-content"
        ref={receiptRef}
        className="pos-receipt-print-area printable-area"
        style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          fontFamily: "Arial, sans-serif",
          maxWidth: "400px",
          margin: "0 auto",
          border: "1px dashed #ccc"
        }}
      >

        {/* HEADER */}
        <div style={{
          textAlign: "center",
          marginBottom: "20px",
          borderBottom: "2px solid #333",
          paddingBottom: "12px"
        }}>
          <h2 style={{
            fontSize: "18px",
            fontWeight: "bold",
            margin: "0 0 4px",
            color: "#333"
          }}>
            🧾 RECEIPT
          </h2>
          <p style={{
            fontSize: "12px",
            color: "#666",
            margin: "0",
            fontWeight: "500"
          }}>
            Receipt ID: {receiptId.slice(-8).toUpperCase()}
          </p>
        </div>

        {/* SELLER INFO */}
        <div style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid #eee"
        }}>
          <p style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#333",
            margin: "0 0 4px"
          }}>
            👨💼 Seller:
          </p>
          <p style={{
            fontSize: "12px",
            color: "#666",
            margin: "0",
            fontWeight: "500"
          }}>
            {sale.sellerName}
          </p>
          {sellerInfo?.phone && (
            <p style={{
              fontSize: "11px",
              color: "#999",
              margin: "2px 0 0"
            }}>
              📞 {sellerInfo.phone}
            </p>
          )}
          {sellerInfo?.address && (
            <p style={{
              fontSize: "11px",
              color: "#999",
              margin: "2px 0 0"
            }}>
              📍 {sellerInfo.address}
            </p>
          )}
        </div>

        {/* CUSTOMER INFO */}
        <div style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid #eee"
        }}>
          <p style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#333",
            margin: "0 0 4px"
          }}>
            👤 Customer:
          </p>
          <p style={{
            fontSize: "12px",
            color: "#666",
            margin: "0",
            fontWeight: "500"
          }}>
            {sale.customerName}
          </p>
          <p style={{
            fontSize: "11px",
            color: "#999",
            margin: "2px 0 0"
          }}>
            📞 {sale.customerPhone}
          </p>
        </div>

        {/* DATE & TIME */}
        <div style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid #eee"
        }}>
          <p style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#333",
            margin: "0 0 4px"
          }}>
            📅 Date & Time:
          </p>
          <p style={{
            fontSize: "12px",
            color: "#666",
            margin: "0",
            fontWeight: "500"
          }}>
            {formatSaleDate(sale.createdAt)}
          </p>
        </div>

        {/* PRODUCT DETAILS */}
        <div style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "2px solid #333"
        }}>
          <p style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#333",
            margin: "0 0 12px"
          }}>
            📦 Items Bought:
          </p>

          <div style={{
            backgroundColor: "#f9f9f9",
            padding: "12px",
            borderRadius: "6px"
          }}>
            {/* Table Header */}
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.5fr", gap: "8px", borderBottom: "1px solid #ddd", paddingBottom: "6px", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#666" }}>Item</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#666" }}>Qty</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#666", textAlign: "right" }}>Total</span>
            </div>

            {/* Items */}
            {sale.items && sale.items.map((item, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.5fr", gap: "8px", marginBottom: "8px" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#333", display: "block" }}>{item.productName}</span>
                  <span style={{ fontSize: "10px", color: "#888" }}>@ {formatCurrency(item.pricePerUnit)}</span>
                </div>
                <span style={{ fontSize: "12px", color: "#333", paddingTop: "2px" }}>{item.quantity}</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#333", textAlign: "right", paddingTop: "2px" }}>{formatCurrency(item.subTotal)}</span>
              </div>
            ))}

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "8px",
              marginTop: "8px",
              borderTop: "1px solid #ddd"
            }}>
              <span style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#333"
              }}>
                Grand Total:
              </span>
              <span style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#27AE60"
              }}>
                {formatCurrency(sale.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* PAYMENT METHOD */}
        <div style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid #eee"
        }}>
          <p style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#333",
            margin: "0 0 4px"
          }}>
            💰 Payment Method:
          </p>
          <p style={{
            fontSize: "12px",
            color: "#666",
            margin: "0",
            fontWeight: "500"
          }}>
            {sale.paymentMethod || "CASH"}
          </p>
        </div>

        {/* NOTES (if any) */}
        {sale.notes && (
          <div style={{
            marginBottom: "16px",
            paddingBottom: "12px",
            borderBottom: "1px solid #eee"
          }}>
            <p style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#333",
              margin: "0 0 4px"
            }}>
              📝 Notes:
            </p>
            <p style={{
              fontSize: "12px",
              color: "#666",
              margin: "0",
              fontStyle: "italic"
            }}>
              {sale.notes}
            </p>
          </div>
        )}

        {/* FOOTER */}
        <div style={{
          textAlign: "center",
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: "2px solid #333"
        }}>
          <p style={{
            fontSize: "11px",
            color: "#999",
            margin: "0 0 8px"
          }}>
            Thank you for your business!
          </p>
          <p style={{
            fontSize: "10px",
            color: "#ccc",
            margin: "0"
          }}>
            Generated on {new Date().toLocaleDateString("en-IN")}
          </p>
        </div>

      </div>

    </div>
  );
};
