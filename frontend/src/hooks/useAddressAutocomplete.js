import { useState, useEffect } from "react";

const useAddressAutocomplete = (inputValue) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!inputValue || inputValue.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/maps/autocomplete?input=${encodeURIComponent(inputValue.trim())}`
        );
        const data = await res.json();
        console.log("🗺️ Suggestions received:", data);
        setSuggestions(data.predictions || []);
      } catch (err) {
        console.error("❌ Fetch error:", err);
        setError(err.message);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [inputValue]);

  return { suggestions, loading, error };
};

export default useAddressAutocomplete;
