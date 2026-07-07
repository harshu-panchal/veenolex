/**
 * scannerPlatform.js — POS barcode scanner keyboard wedge handler helper.
 *
 * External USB scanners act as a virtual keyboard (wedge). They type characters
 * extremely fast (usually less than 30ms between characters) and finish with "Enter".
 * This helper listens to key presses globally and parses scans without interfering
 * with normal user input.
 */

let buffer = "";
let lastKeyTime = 0;

/**
 * Initializes a global key listener for USB barcode wedge scanner.
 *
 * @param {Function} onScan - Callback when a valid barcode is read. Passes barcode string.
 * @returns {Function} Cleanup function to remove event listener
 */
export function initWedgeScanner(onScan) {
  const handleKeyDown = (e) => {
    // If the active element is a text input, skip listening to prevent collision
    // (unless the input has the 'data-scanner-target' attribute).
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") {
      const isTarget = e.target.hasAttribute("data-scanner-target");
      if (!isTarget) {
        return;
      }
    }

    const now = Date.now();
    const diff = now - lastKeyTime;
    lastKeyTime = now;

    // A time difference of > 100ms indicates human typing, reset buffer
    if (diff > 100) {
      buffer = "";
    }

    // Standard barcode scanner triggers "Enter" at the end of scan
    if (e.key === "Enter") {
      if (buffer.length >= 3) {
        e.preventDefault();
        onScan(buffer);
      }
      buffer = "";
      return;
    }

    // Ignore modifier keys
    if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}
export default initWedgeScanner;
