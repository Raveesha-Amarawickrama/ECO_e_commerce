import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Order from "../model/orderModel.js";
import Payment from "../model/paymentModel.js";
import Product from "../model/productModel.js";
import { getOrCreateSessionId } from "../utils/generateSessionId.js";

// @desc    Place a new order (guest checkout)
// @route   POST /order/checkout
// @access  Public
export const placeOrder = asyncErrorHandler(async (req, res, next) => {
  console.log("📥 Received order request");
  
  const {
    customerName,
    customerEmail,
    customerPhone,
    address,
    city,
    state,
    zipCode,
    country,
    items,
    subtotal,
    shippingCost,
    tax,
    totalAmount,
    paymentMethod,
    shippingMethod,
    town,
    orderNotes
  } = req.body;

  // Validation
  if (!customerName || !customerEmail || !customerPhone || !address || !city || !totalAmount || !items || items.length === 0) {
    const error = new CustomError("Missing required order information", 400);
    return next(error);
  }

  // Get or create session ID
  const sessionId = getOrCreateSessionId(req);

  // Create order
  const order = await Order.create({
    customerName,
    customerEmail,
    customerPhone,
    address,
    city,
    state: state || "",
    zipCode: zipCode || "",
    country: country || "Sri Lanka",
    items,
    subtotal: subtotal || 0,
    shippingCost: shippingCost || 0,
    tax: tax || 0,
    totalAmount,
    paymentMethod: paymentMethod || "cod",
    shippingMethod: shippingMethod || "pickup",
    town: town || "",
    orderNotes: orderNotes || "",
    sessionId,
    orderStatus: "pending",
    paymentStatus: paymentMethod === "cod" ? "unpaid" : "unpaid"
  });

  console.log("✅ Order created:", order.orderNumber);

 // Replace the res.status(201).json in your placeOrder function with this:

res.status(201).json({
  success: true,
  message: "Order placed successfully",
  order: {
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    address: order.address,
    city: order.city,
   
    items: order.items
  }
});
});

// @desc    Get order details by order number
// @route   GET /order/:orderNumber
// @access  Public
export const getOrderDetails = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;

  const order = await Order.findOne({ orderNumber });

  if (!order) {
    const error = new CustomError("Order not found", 404);
    return next(error);
  }

  res.status(200).json({
    success: true,
    order
  });
});

// @desc    Get orders by session ID
// @route   GET /order/session/:sessionId
// @access  Public
export const getOrdersBySession = asyncErrorHandler(async (req, res, next) => {
  const { sessionId } = req.params;

  const orders = await Order.find({ sessionId })
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders
  });
});

// @desc    Get all orders (Admin)
// @route   GET /order/admin/all
// @access  Private/Admin
export const getAllOrders = asyncErrorHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments();

  res.status(200).json({
    success: true,
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Update order status
// @route   PUT /order/:orderNumber/status
// @access  Private/Admin
export const updateOrderStatus = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;
  const { orderStatus } = req.body;

  const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  
  if (!validStatuses.includes(orderStatus)) {
    const error = new CustomError("Invalid order status", 400);
    return next(error);
  }

  const order = await Order.findOneAndUpdate(
    { orderNumber },
    { orderStatus },
    { new: true, runValidators: true }
  );

  if (!order) {
    const error = new CustomError("Order not found", 404);
    return next(error);
  }

  console.log(`✅ Order ${orderNumber} status updated to ${orderStatus}`);

  res.status(200).json({
    success: true,
    message: `Order status updated to ${orderStatus}`,
    order
  });
});

// @desc    Update payment status
// @route   PUT /order/:orderNumber/payment
// @access  Private/Admin
export const updatePaymentStatus = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;
  const { paymentStatus } = req.body;

  const validStatuses = ["unpaid", "paid", "failed", "refunded"];
  
  if (!validStatuses.includes(paymentStatus)) {
    const error = new CustomError("Invalid payment status", 400);
    return next(error);
  }

  const order = await Order.findOneAndUpdate(
    { orderNumber },
    { paymentStatus },
    { new: true, runValidators: true }
  );

  if (!order) {
    const error = new CustomError("Order not found", 404);
    return next(error);
  }

  console.log(`✅ Order ${orderNumber} payment status updated to ${paymentStatus}`);

  res.status(200).json({
    success: true,
    message: `Payment status updated to ${paymentStatus}`,
    order
  });
});