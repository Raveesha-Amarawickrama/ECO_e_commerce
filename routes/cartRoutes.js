import { Router } from "express";
import {
  addToCart,
  getCart,
  updateCart,
  removeFromCart,
  clearCart,
  getCartCount
} from "../controller/cartController.js";

const router = Router();

// All routes are public (No authentication required)

// GET - Get cart items
router.get("/", getCart);

// GET - Get cart count
router.get("/count", getCartCount);

// POST - Add to cart
router.post("/add", addToCart);

// POST - Update quantity
router.post("/update", updateCart);

// POST - Remove from cart
router.post("/remove", removeFromCart);

// POST - Clear cart
router.post("/clear", clearCart);

export default router;