
import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Cart from "../model/cartModel.js";
import Order from "../model/orderModel.js";
import Product from "../model/productModel.js";
import { getOrCreateSessionId } from "../utils/generateSessionId.js";

// @desc    Place order from cart with customer details
// @route   POST /order/checkout
// @access  Public (Guest checkout - no auth required)
export const placeOrder = asyncErrorHandler(async (req, res, next) => {
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
    shippingMethod,
    town,
    orderNotes,
    shippingCost,
    taxRate
  } = req.body;

  // Validate customer details
  if (!customerName || !customerEmail || !customerPhone || !address || !city || !zipCode || !country) {
    const error = new CustomError("All required customer details must be provided", 400);
    return next(error);
  }

  // Validate payment method - UPDATED to include 'payhere'
  if (!paymentMethod || !['cod', 'card', 'payhere'].includes(paymentMethod)) {
    const error = new CustomError("Valid payment method is required (cod, card, or payhere)", 400);
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

  // Calculate totals (NO TAX)
  const subtotal = cart.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  const shipping = shippingCost || 0;
  const tax = 0; // No tax
  const totalAmount = subtotal + shipping;

  // Create order items with weight
  const orderItems = cart.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    price: item.price,
    quantity: item.quantity,
    mainImage: item.mainImage,
    color: item.color,
    size: item.size,
    weight: item.weight || 0,
    total: item.price * item.quantity
  }));

  // Determine initial payment status based on payment method
  const initialPaymentStatus = (paymentMethod === 'card' || paymentMethod === 'payhere') ? 'unpaid' : 'unpaid';

  // Create order
  const order = new Order({
    customerName,
    customerEmail,
    customerPhone,
    address,
    city,
    state: state || '',
    zipCode,
    country,
    items: orderItems,
    subtotal,
    shippingCost: shipping,
    tax: 0,
    totalAmount,
    paymentMethod,
    shippingMethod: shippingMethod || 'pickup',
    town: town || '',
    orderNotes: orderNotes || '',
    sessionId,
    orderStatus: "pending",
    paymentStatus: initialPaymentStatus
  });

  // Save order
  try {
    await order.save();
    
    // Verify order was saved with orderNumber
    if (!order.orderNumber) {
      throw new Error("Order number was not generated");
    }

    console.log("Order created successfully:", order.orderNumber);
  } catch (error) {
    console.error("Error saving order:", error);
    const customError = new CustomError("Failed to create order. Please try again.", 500);
    return next(customError);
  }

  // Reduce product stock
  try {
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { item_count: -item.quantity } },
        { new: true }
      );
    }
  } catch (error) {
    console.error("Error updating stock:", error);
    // Stock update failed but order was created - log this for manual review
  }

  // Clear cart after successful order
  try {
    cart.items = [];
    await cart.save();
  } catch (error) {
    console.error("Error clearing cart:", error);
    // Cart clearing failed but order was created - not critical
  }

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    order: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      address: order.address,
      city: order.city,
      items: order.items,
      createdAt: order.createdAt
    }
  });
});

// @desc    Get order details
// @route   GET /order/:orderNumber
// @access  Public (Guest can view with order number)
export const getOrderDetails = asyncErrorHandler(async (req, res, next) => {
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
// @route   GET /order/session/:sessionId
// @access  Public
export const getOrdersBySession = asyncErrorHandler(async (req, res, next) => {
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
// @route   GET /order/admin/all
// @access  Private (Admin only)
export const getAllOrders = asyncErrorHandler(async (req, res, next) => {
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
// @route   PUT /order/:orderNumber/status
// @access  Private (Admin only)
export const updateOrderStatus = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;
  const { orderStatus, trackingNumber } = req.body;

  const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  
  if (!validStatuses.includes(orderStatus)) {
    const error = new CustomError("Invalid order status", 400);
    return next(error);
  }

  const order = await Order.findOneAndUpdate(
    { orderNumber },
    {
      orderStatus,
      ...(trackingNumber && { trackingNumber }),
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

// @desc    Update payment status (Admin or Payment Gateway)
// @route   PUT /order/:orderNumber/payment
// @access  Public (for payment gateway callbacks)
export const updatePaymentStatus = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;
  const { paymentStatus, paymentMethod } = req.body;

  const validPaymentStatuses = ["unpaid", "paid", "failed", "refunded"];
  
  if (!validPaymentStatuses.includes(paymentStatus)) {
    const error = new CustomError("Invalid payment status", 400);
    return next(error);
  }

  const updateData = {
    paymentStatus,
    updatedAt: new Date()
  };

  if (paymentMethod) {
    updateData.paymentMethod = paymentMethod;
  }

  // If payment is successful, update order status to confirmed
  if (paymentStatus === 'paid') {
    updateData.orderStatus = 'confirmed';
  }

  const order = await Order.findOneAndUpdate(
    { orderNumber },
    updateData,
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
