import { Router } from "express";
import {
  addToCart,
  getCart,
  updateCart,
  removeFromCart,
  clearCart,
  getCartCount,
  syncCart
} from "../controller/cartController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// Public routes (work for both guest and authenticated users)
// These routes check if user is authenticated and use userId if available

// GET - Get cart items
router.get("/", protect, getCart); // protect is optional - allows both authenticated and guest

// GET - Get cart count
router.get("/count", protect, getCartCount);

// POST - Add to cart
router.post("/add", protect, addToCart);

// POST - Update quantity
router.post("/update", protect, updateCart);

// POST - Remove from cart
router.post("/remove", protect, removeFromCart);

// POST - Clear cart
router.post("/clear", protect, clearCart);

// Protected route (requires authentication)
// POST - Sync guest cart to user cart after login
router.post("/sync", protect, syncCart);

export default router;