
import { Router } from "express";
import {
  placeOrder,
  getOrderDetails,
  getOrdersBySession,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus
} from "../controller/orderController.js";
import {
  initiatePayment,
  paymentNotify,
  getPaymentDetails,
  getAllPayments
} from "../controller/paymentController.js";

const router = Router();

// ============ ORDER ROUTES ============

// POST - Place order with customer details
router.post("/checkout", placeOrder);

// GET - Get orders by session ID (guest orders) - MUST BE BEFORE /:orderNumber
router.get("/session/:sessionId", getOrdersBySession);

// Admin routes - MUST BE BEFORE /:orderNumber
router.get("/admin/all", getAllOrders);

// PUT - Update order status (admin only)
router.put("/:orderNumber/status", updateOrderStatus);

// PUT - Update payment status (admin only or payment gateway)
router.put("/:orderNumber/payment", updatePaymentStatus);

// GET - Get order details by order number - MUST BE LAST DYNAMIC ROUTE
router.get("/:orderNumber", getOrderDetails);

// ============ PAYMENT ROUTES ============

// POST - Initiate PayHere payment
router.post("/:orderNumber/initiate-payment", initiatePayment);

// POST - PayHere notification webhook
router.post("/payment/notify", paymentNotify);

// GET - Get payment details
router.get("/payment/:orderNumber", getPaymentDetails);

// GET - Get all payments (Admin)
router.get("/admin/payments", getAllPayments);

export default router;

