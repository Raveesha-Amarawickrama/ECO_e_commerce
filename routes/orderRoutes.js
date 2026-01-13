// ============================================
// FILE: routes/orderRoutes.js (MAIN ORDER ROUTES)
// ============================================
import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  // Guest/Public order functions
  placeOrder,
  getOrderDetails,
  getOrdersBySession,
  
  // Authenticated user order functions
  addOrder,
  getOrdersByUser,
  getOneDetails,
  
  // Admin functions
  getAllOrders,
  updateOrderStatus,
  updateStatus,
  updatePaymentStatus,
  
  // Order management
  getOrderWithProductDetails,
} from "../controller/orderController.js";

import {
  initiatePayment,
  paymentNotify,
  getPaymentDetails,
  getAllPayments
} from "../controller/paymentController.js";

const router = Router();

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Guest checkout - place order without login
router.post("/checkout", placeOrder);

// Get order by order number (for order tracking)
router.get("/track/:orderNumber", getOrderDetails);

// Get orders by session ID (guest orders)
router.get("/session/:sessionId", getOrdersBySession);

// ============================================
// PAYMENT WEBHOOK ROUTES (Public - for payment gateways)
// ============================================

// PayHere payment notification webhook
router.post("/payment/notify", paymentNotify);
router.post("/payment-notify", paymentNotify); // Alternative endpoint

// ============================================
// AUTHENTICATED USER ROUTES (Login Required)
// ============================================

// Create order for logged-in user
router.post("/create", protect, addOrder);

// Get user's own orders
router.get("/my-orders", protect, getOrdersByUser);
router.get("/user/:userId/orders", protect, getOrdersByUser);

// Get specific order details
router.get("/details/:id", protect, getOneDetails);

// ============================================
// PAYMENT ROUTES (User)
// ============================================

// Initiate PayHere payment for an order
router.post("/:orderNumber/initiate-payment", protect, initiatePayment);

// Get payment details for an order
router.get("/payment/:orderNumber", protect, getPaymentDetails);

// ============================================
// ADMIN ROUTES (Admin Only)
// ============================================

// Get all orders with product details (Admin)
router.get("/admin/all", protect, getAllOrders);
router.get("/admin/details", protect, getOrderWithProductDetails);

// Get all payments (Admin)
router.get("/admin/payments", protect, getAllPayments);

// Update order status (Admin)
router.put("/admin/:orderNumber/status", protect, updateOrderStatus);
router.patch("/admin/:id/update-status", protect, updateStatus);

// Update payment status (Admin)
router.put("/admin/:orderNumber/payment", protect, updatePaymentStatus);

// ============================================
// IMPORTANT: Dynamic routes MUST be at the end
// ============================================

// Get order by order number (catch-all - must be last)
router.get("/:orderNumber", getOrderDetails);

export default router;

// ============================================
// USAGE IN server.js:
// ============================================
// import orderRoutes from './routes/orderRoutes.js';
// app.use("/order", orderRoutes);
//
// This will create endpoints like:
// - POST   /order/checkout (guest)
// - POST   /order/create (authenticated)
// - GET    /order/my-orders (authenticated)
// - GET    /order/track/:orderNumber (public)
// - GET    /order/:orderNumber (public)
// - GET    /order/admin/all (admin)
// - PUT    /order/admin/:orderNumber/status (admin)
// - POST   /order/payment/notify (webhook)
// ============================================