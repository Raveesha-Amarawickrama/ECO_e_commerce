// routes/wishlistRoutes.js
import { Router } from "express";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  clearWishlist,
  getWishlistCount,
  syncWishlist,
  cleanupWishlist
} from "../controller/wishlistController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// CRITICAL: All wishlist routes REQUIRE authentication (use requireAuth)
// Wishlist is not available for guest users

// GET routes
router.get("/", requireAuth, getWishlist);
router.get("/count", requireAuth, getWishlistCount);

// POST routes
router.post("/add", requireAuth, addToWishlist);
router.post("/remove", requireAuth, removeFromWishlist);
router.post("/clear", requireAuth, clearWishlist);
router.post("/sync", requireAuth, syncWishlist);
router.post("/cleanup", requireAuth, cleanupWishlist);

export default router;