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

// POST - Place order (guest checkout)
router.post("/checkout", placeOrder);

// GET - Get orders by session ID - MUST BE BEFORE /:orderNumber
router.get("/session/:sessionId", getOrdersBySession);

// Admin routes - MUST BE BEFORE /:orderNumber
router.get("/admin/all", getAllOrders);
router.get("/admin/payments", getAllPayments);

// PUT - Update order status
router.put("/:orderNumber/status", updateOrderStatus);

// PUT - Update payment status
router.put("/:orderNumber/payment", updatePaymentStatus);

// GET - Get order details by order number - MUST BE LAST DYNAMIC ROUTE
router.get("/:orderNumber", getOrderDetails);

// ============ PAYMENT ROUTES ============

// POST - PayHere notification webhook (PUBLIC)
router.post("/payment/notify", paymentNotify);

// POST - Initiate PayHere payment
router.post("/:orderNumber/initiate-payment", initiatePayment);

// GET - Get payment details
router.get("/payment/:orderNumber", getPaymentDetails);

export default router;