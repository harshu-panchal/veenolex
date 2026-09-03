let razorpayPromise = null;

/**
 * Dynamically loads and preloads the Razorpay checkout script.
 * Caches the promise to prevent duplicate script tags and ensures instant resolution.
 * @returns {Promise<boolean>} Resolves to true if script loads successfully, else false.
 */
export const loadRazorpayScript = () => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayPromise) return razorpayPromise;

  const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existingScript) {
    if (window.Razorpay) return Promise.resolve(true);
    razorpayPromise = new Promise((resolve) => {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => {
        razorpayPromise = null;
        resolve(false);
      }, { once: true });
    });
    return razorpayPromise;
  }

  razorpayPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayPromise;
};
