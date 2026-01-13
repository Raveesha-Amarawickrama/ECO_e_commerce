import { Router } from "express";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  clearWishlist,
  getWishlistCount,
  syncWishlist
} from "../controller/wishlistController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// Public routes (work for both guest and authenticated users)
router.get("/", protect, getWishlist);
router.get("/count", protect, getWishlistCount);
router.post("/add", protect, addToWishlist);
router.post("/remove", protect, removeFromWishlist);
router.post("/clear", protect, clearWishlist);

// Protected route - Sync guest wishlist after login
router.post("/sync", protect, syncWishlist);

export default router;