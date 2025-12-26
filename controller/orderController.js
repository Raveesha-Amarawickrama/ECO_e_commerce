import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Cart from "../model/cartModel.js";
import Order from "../model/orderModel.js";
import Product from "../model/productModel.js";
import { getOrCreateSessionId } from "../utils/generateSessionId.js";

// @desc    Place order from cart with customer details
// @route   POST /checkout/checkout
// @access  Public (Guest checkout - no auth required)
const placeOrder = asyncErrorHandler(async (req, res, next) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    address,
    city,
    state,
    zipCode,
    country,
    paymentMethod,
    orderNotes,
    shippingCost,
    taxRate
  } = req.body;

  // Validate customer details
  if (!customerName || !customerEmail || !customerPhone || !address || !city || !state || !zipCode || !country) {
    const error = new CustomError("All customer details are required", 400);
    return next(error);
  }

  const sessionId = getOrCreateSessionId(req);

  // Get cart
  const cart = await Cart.findOne({ sessionId });

  if (!cart || cart.items.length === 0) {
    const error = new CustomError("Cart is empty", 400);
    return next(error);
  }

  // Validate stock for all items
  for (const item of cart.items) {
    const product = await Product.findById(item.productId);
    if (!product || product.item_count < item.quantity) {
      const error = new CustomError(
        `${item.productName} has insufficient stock`,
        400
      );
      return next(error);
    }
  }

  // Calculate totals
  const subtotal = cart.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  const shipping = shippingCost || 0;
  const tax = subtotal * (taxRate || 0.1);
  const totalAmount = subtotal + shipping + tax;

  // Create order items
  const orderItems = cart.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    price: item.price,
    quantity: item.quantity,
    mainImage: item.mainImage,
    color: item.color,
    size: item.size,
    total: item.price * item.quantity
  }));

  // Create order
  const order = new Order({
    customerName,
    customerEmail,
    customerPhone,
    address,
    city,
    state,
    zipCode,
    country,
    items: orderItems,
    subtotal,
    shippingCost: shipping,
    tax,
    totalAmount,
    paymentMethod: paymentMethod || "cod",
    orderNotes,
    sessionId,
    orderStatus: "pending",
    paymentStatus: paymentMethod === "cod" ? "unpaid" : "unpaid"
  });

  await order.save();

  // Reduce product stock
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(
      item.productId,
      { $inc: { item_count: -item.quantity } },
      { new: true }
    );
  }

  // Clear cart after successful order
  cart.items = [];
  await cart.save();

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    order: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt
    }
  });
});

// @desc    Get order details
// @route   GET /checkout/:orderNumber
// @access  Public (Guest can view with order number)
const getOrderDetails = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;

  const order = await Order.findOne({ orderNumber }).populate("items.productId");

  if (!order) {
    const error = new CustomError("Order not found", 404);
    return next(error);
  }

  res.status(200).json({
    success: true,
    order
  });
});

// @desc    Get all orders by session (guest orders)
// @route   GET /checkout/session/:sessionId
// @access  Public
const getOrdersBySession = asyncErrorHandler(async (req, res, next) => {
  const { sessionId } = req.params;

  const orders = await Order.find({ sessionId })
    .select("-items.productId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    orders,
    count: orders.length
  });
});

// @desc    Get all orders (Admin)
// @route   GET /checkout/admin/all
// @access  Private (Admin only)
const getAllOrders = asyncErrorHandler(async (req, res, next) => {
  const orders = await Order.find()
    .populate("items.productId")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    orders,
    count: orders.length
  });
});

// @desc    Update order status (Admin)
// @route   PUT /checkout/:orderNumber/status
// @access  Private (Admin only)
const updateOrderStatus = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;
  const { orderStatus, trackingNumber } = req.body;

  const order = await Order.findOneAndUpdate(
    { orderNumber },
    {
      orderStatus,
      trackingNumber,
      updatedAt: new Date()
    },
    { new: true }
  );

  if (!order) {
    const error = new CustomError("Order not found", 404);
    return next(error);
  }

  res.status(200).json({
    success: true,
    message: "Order status updated",
    order
  });
});

// @desc    Update payment status (Admin)
// @route   PUT /checkout/:orderNumber/payment
// @access  Private (Admin only)
const updatePaymentStatus = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;
  const { paymentStatus } = req.body;

  const order = await Order.findOneAndUpdate(
    { orderNumber },
    {
      paymentStatus,
      updatedAt: new Date()
    },
    { new: true }
  );

  if (!order) {
    const error = new CustomError("Order not found", 404);
    return next(error);
  }

  res.status(200).json({
    success: true,
    message: "Payment status updated",
    order
  });
});

export {
  placeOrder,
  getOrderDetails,
  getOrdersBySession,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus
};