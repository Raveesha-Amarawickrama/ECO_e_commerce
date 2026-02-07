// routes/cartRoutes.js
import { Router } from "express";
import {
  addToCart,
  getCart,
  updateCart,
  removeFromCart,
  clearCart,
  getCartCount,
  syncCart,
  mergeCart
} from "../controller/cartController.js";
import { protect, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// CRITICAL: Public routes use 'protect' (optional auth - works for guest AND authenticated)
// These routes check if user is authenticated, but allow requests without auth
router.get("/", protect, getCart);
router.get("/count", protect, getCartCount);
router.post("/add", protect, addToCart);
router.post("/update", protect, updateCart);
router.post("/remove", protect, removeFromCart);
router.post("/clear", protect, clearCart);

// CRITICAL: Sync/merge routes use 'requireAuth' (authentication REQUIRED)
// These routes need a valid user to sync guest cart to user cart
router.post("/sync", requireAuth, syncCart);
router.post("/merge", requireAuth, mergeCart);

export default router;