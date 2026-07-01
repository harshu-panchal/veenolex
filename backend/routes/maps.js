import express from "express";
import axios from "axios";

const router = express.Router();

// Test route — visit /api/maps/ping to confirm backend is working
router.get("/ping", (req, res) => {
  res.json({ message: "Maps route is working ✅" });
});

// Autocomplete route
router.get("/autocomplete", async (req, res) => {
  const { input } = req.query;

  console.log("📍 Autocomplete request received for:", input);
  console.log("🔑 API Key present:", !!process.env.GOOGLE_MAPS_API_KEY);

  if (!input || input.trim().length < 2) {
    return res.status(400).json({ error: "Input too short" });
  }

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json",
      {
        params: {
          input: input.trim(),
          key: process.env.GOOGLE_MAPS_API_KEY,
          components: "country:in",
          types: "address",
          language: "en",
        },
      }
    );

    console.log("✅ Google API status:", response.data.status);
    console.log("📦 Predictions count:", response.data.predictions?.length);

    res.json(response.data);
  } catch (error) {
    console.error("❌ Google API Error:", error.message);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

export default router;
