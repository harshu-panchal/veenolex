import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, RefreshCw } from "lucide-react";

/**
 * QRScannerModal — Camera-based QR/Barcode scanner modal.
 *
 * Utilizes `html5-qrcode` library to access the user's camera and decode
 * barcodes or QR codes in real-time.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onScan - Callback when code detected. Passes the raw text.
 */
export function QRScannerModal({ isOpen, onClose, onScan }) {
  const [cameras, setCameras] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Get available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Default to back camera if available, otherwise first camera
          const backCam = devices.find((device) =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("environment")
          );
          const defaultCamId = backCam ? backCam.id : devices[0].id;
          setActiveCameraId(defaultCamId);
          startScanning(defaultCamId);
        } else {
          setErrorMsg("No camera devices found");
        }
      })
      .catch((err) => {
        console.error("Failed to get cameras", err);
        setErrorMsg("Camera permission denied or not available");
      });

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = (cameraId) => {
    stopScanning();

    // Create unique scanner container ID
    const scannerId = "pos-camera-scanner-view";
    const html5Qrcode = new Html5Qrcode(scannerId);
    html5QrcodeRef.current = html5Qrcode;

    html5Qrcode
      .start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Success callback
          onScan(decodedText);
          stopScanning();
          onClose();
        },
        (errorMessage) => {
          // Silent failure (scanning frame didn't contain valid code)
        }
      )
      .catch((err) => {
        console.error("Failed to start scanner", err);
        setErrorMsg("Failed to start camera feed");
      });
  };

  const stopScanning = () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      html5QrcodeRef.current
        .stop()
        .then(() => {
          html5QrcodeRef.current = null;
        })
        .catch((err) => console.error("Failed to stop scanner", err));
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamId = cameras[nextIndex].id;
    setActiveCameraId(nextCamId);
    startScanning(nextCamId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold font-outfit">Barcode / QR Scanner</h3>
          </div>
          <button
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Feed Area */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center">
          <div id="pos-camera-scanner-view" ref={scannerRef} className="w-full h-full object-cover" />

          {/* Scanner Guide Overlay */}
          {activeCameraId && !errorMsg && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[260px] h-[260px] border-2 border-emerald-400/80 rounded-xl relative">
                {/* Laser animation */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_#ef4444] animate-pulse" />
                {/* Corners */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-6 text-center">
              <Camera className="w-12 h-12 text-zinc-600 mb-4 animate-bounce" />
              <p className="text-sm text-zinc-400 mb-6">{errorMsg}</p>
              <button
                onClick={() => {
                  setErrorMsg("");
                  // Retry finding cameras
                  Html5Qrcode.getCameras().then((devices) => {
                    if (devices && devices.length > 0) {
                      setCameras(devices);
                      setActiveCameraId(devices[0].id);
                      startScanning(devices[0].id);
                    } else {
                      setErrorMsg("No camera devices found");
                    }
                  });
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 font-semibold rounded-lg text-sm transition-all"
              >
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Footer / Controls */}
        <div className="px-6 py-4 bg-zinc-950 flex justify-between items-center border-t border-zinc-800">
          <p className="text-xs text-zinc-400">Position barcode/QR inside the frame to scan</p>
          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-xs rounded-lg transition-colors font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Switch Camera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default QRScannerModal;
