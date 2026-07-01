import express from "express";
import User from "../models/customer.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.patch("/update-location", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const { location } = req.body;

        if (!location) {
            return res.status(400).json({ success: false, message: "Location data is required" });
        }

        const { latitude, longitude, address, city, pincode, state } = location;

        const updatedUser = await User.findByIdAndUpdate(userId, {
            "location.latitude": latitude,
            "location.longitude": longitude,
            "location.address": address,
            "location.city": city,
            "location.pincode": pincode,
            "location.state": state,
            "location.updatedAt": new Date()
        }, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({
            success: true,
            message: "Location updated",
            location: { latitude, longitude, address, city }
        });
    } catch (error) {
        console.error("Error updating location:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
