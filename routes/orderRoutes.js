import { Router } from "express";
import {
  placeOrder,
  getOrderDetails,
  getOrdersBySession,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus
} from "../controller/orderController.js";

const router = Router();

// Public routes (No auth required for guest checkout)

// POST - Place order with customer details
router.post("/checkout", placeOrder);

// GET - Get order details by order number
router.get("/:orderNumber", getOrderDetails);

// GET - Get orders by session ID (guest orders)
router.get("/session/:sessionId", getOrdersBySession);

// Admin routes (if you add auth later)

// GET - Get all orders (admin only)
router.get("/admin/all", getAllOrders);

// PUT - Update order status (admin only)
router.put("/:orderNumber/status", updateOrderStatus);

// PUT - Update payment status (admin only)
router.put("/:orderNumber/payment", updatePaymentStatus);

export default router;