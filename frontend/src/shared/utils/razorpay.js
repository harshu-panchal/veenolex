/**
 * Dynamically loads the Razorpay checkout script.
 * @returns {Promise<boolean>} Resolves to true if script loads successfully, else false.
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    // If script is already loaded, resolve immediately
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};
