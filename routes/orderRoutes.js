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

// GET - Get orders by session ID (guest orders) - MUST BE BEFORE /:orderNumber
router.get("/session/:sessionId", getOrdersBySession);

// Admin routes - MUST BE BEFORE /:orderNumber
router.get("/admin/all", getAllOrders);

// PUT - Update order status (admin only)
router.put("/:orderNumber/status", updateOrderStatus);

// PUT - Update payment status (admin only)
router.put("/:orderNumber/payment", updatePaymentStatus);

// GET - Get order details by order number - MUST BE LAST DYNAMIC ROUTE
router.get("/:orderNumber", getOrderDetails);

export default router;