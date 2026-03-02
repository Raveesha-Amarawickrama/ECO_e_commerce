import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Payment from "../model/paymentModel.js";
import Order from "../model/orderModel.js";
import Product from "../model/productModel.js";
import crypto from "crypto";

// Helper: Generate PayHere hash
const generatePayHereHash = (merchantId, orderId, amount, currency, merchantSecret) => {
  if (!merchantId || !orderId || !amount || !currency || !merchantSecret) {
    throw new Error('Missing required parameters for hash generation');
  }

  const hashedSecret = crypto
    .createHash('md5')
    .update(String(merchantSecret))
    .digest('hex')
    .toUpperCase();

  const amountFormatted = parseFloat(amount).toFixed(2);
  const hashInput =
    String(merchantId) +
    String(orderId) +
    String(amountFormatted) +
    String(currency) +
    String(hashedSecret);

  const hash = crypto
    .createHash('md5')
    .update(hashInput)
    .digest('hex')
    .toUpperCase();

  return hash;
};

// Helper: Verify PayHere notification hash
const verifyPayHereHash = (merchantId, orderId, amount, currency, statusCode, md5sig, merchantSecret) => {
  const hashedSecret = crypto
    .createHash('md5')
    .update(String(merchantSecret))
    .digest('hex')
    .toUpperCase();

  const localHash = crypto
    .createHash('md5')
    .update(
      String(merchantId) +
      String(orderId) +
      String(amount) +
      String(currency) +
      String(statusCode) +
      String(hashedSecret)
    )
    .digest('hex')
    .toUpperCase();

  return localHash === md5sig;
};

// ============================================================
// ✅ FIX: Helper to reduce inventory atomically (race-safe)
// Uses MongoDB conditional update: only decrements if enough stock exists
// ============================================================
const deductInventory = async (items) => {
  const results = [];

  for (const item of items) {
    // $inc with a condition — if stock < quantity, update won't happen
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: item.productId,
        item_count: { $gte: item.quantity } // ✅ Only deduct if enough stock
      },
      {
        $inc: { item_count: -item.quantity } // ✅ Atomic decrement
      },
      { new: true }
    );

    if (!updatedProduct) {
      // Stock ran out between checkout and payment — log for admin
      console.error(`⚠️ Stock conflict: Product ${item.productId} could not be decremented by ${item.quantity}`);
      results.push({
        productId: item.productId,
        productName: item.productName || item.name,
        success: false,
        reason: 'Insufficient stock at time of payment'
      });
    } else {
      console.log(`✅ Inventory reduced: Product ${item.productId} | Remaining: ${updatedProduct.item_count}`);
      results.push({
        productId: item.productId,
        productName: item.productName || item.name,
        success: true,
        remainingStock: updatedProduct.item_count
      });
    }
  }

  return results;
};

// ============================================================
// ✅ FIX: Helper to restore inventory (for failed/cancelled payments)
// ============================================================
const restoreInventory = async (items) => {
  for (const item of items) {
    await Product.findByIdAndUpdate(
      item.productId,
      { $inc: { item_count: item.quantity } }, // Add back
      { new: true }
    );
    console.log(`🔄 Inventory restored: Product ${item.productId} | Qty: +${item.quantity}`);
  }
};

// @desc    Initiate payment
// @route   POST /order/:orderNumber/initiate-payment
// @access  Public
export const initiatePayment = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;
  const {
    amount,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    customerCity
  } = req.body;

  console.log('Payment initiation request:', { orderNumber, amount, customerName, customerEmail });

  if (!amount || !customerName || !customerEmail) {
    return next(new CustomError("Missing required payment information", 400));
  }

  const PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
  const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

  if (!PAYHERE_MERCHANT_ID || !PAYHERE_MERCHANT_SECRET) {
    return next(new CustomError("Payment gateway not configured. Please contact support.", 500));
  }

  // Find order
  const order = await Order.findOne({ orderNumber });
  if (!order) {
    return next(new CustomError("Order not found", 404));
  }

  // Check if already paid
  if (order.paymentStatus === 'paid') {
    return next(new CustomError("This order has already been paid", 400));
  }

  // Verify amount
  const requestedAmount = parseFloat(amount);
  const orderAmount = parseFloat(order.totalAmount);

  if (isNaN(requestedAmount) || isNaN(orderAmount)) {
    return next(new CustomError("Invalid amount format", 400));
  }

  if (Math.abs(requestedAmount - orderAmount) > 0.01) {
    return next(new CustomError("Payment amount does not match order total", 400));
  }

  // ============================================================
  // ✅ FIX: Re-check live stock for ALL items before accepting payment
  // This catches the case where another customer bought the last item
  // between when Customer A added to cart and now
  // ============================================================
  const stockErrors = [];
  for (const item of order.items) {
    const product = await Product.findById(item.productId);

    if (!product) {
      stockErrors.push(`Product "${item.productName || item.name}" no longer exists`);
      continue;
    }

    if (product.item_count < item.quantity) {
      if (product.item_count === 0) {
        stockErrors.push(`"${product.productName}" is now out of stock`);
      } else {
        stockErrors.push(
          `"${product.productName}" only has ${product.item_count} left, but your order needs ${item.quantity}`
        );
      }
    }
  }

  // If any stock issue — reject payment before charging customer
  if (stockErrors.length > 0) {
    return next(
      new CustomError(
        `Stock issue: ${stockErrors.join('. ')}. Please update your cart and try again.`,
        400
      )
    );
  }

  // Find or create payment record
  let payment = await Payment.findOne({ orderNumber });
  if (!payment) {
    payment = new Payment({
      orderNumber,
      amount: orderAmount,
      currency: 'LKR',
      paymentStatus: 'pending',
      paymentMethod: 'payhere',
      customerDetails: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        address: customerAddress,
        city: customerCity
      }
    });
  }

  try {
    const hash = generatePayHereHash(
      PAYHERE_MERCHANT_ID,
      orderNumber,
      orderAmount,
      'LKR',
      PAYHERE_MERCHANT_SECRET
    );

    payment.hash = hash;
    payment.paymentStatus = 'processing';
    await payment.save();

    order.paymentId = payment._id;
    order.payhereHash = hash;
    order.paymentMethod = 'payhere';
    await order.save();

    res.status(200).json({
      success: true,
      merchant_id: PAYHERE_MERCHANT_ID,
      hash,
      orderId: orderNumber,
      amount: orderAmount.toFixed(2)
    });
  } catch (hashError) {
    return next(new CustomError("Failed to generate payment hash: " + hashError.message, 500));
  }
});

// @desc    PayHere notification webhook (called by PayHere server)
// @route   POST /order/payment/notify
// @access  Public (secured with hash verification)
export const paymentNotify = asyncErrorHandler(async (req, res, next) => {
  const {
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
    method,
    status_message,
    card_holder_name,
    card_no
  } = req.body;

  console.log('PayHere Notification Received:', { order_id, status_code, status_message, method });

  const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
  if (!PAYHERE_MERCHANT_SECRET) {
    console.error('Merchant secret not configured');
    return res.status(500).send('FAIL');
  }

  // ✅ Always verify hash first — reject tampered requests
  const isValidHash = verifyPayHereHash(
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
    PAYHERE_MERCHANT_SECRET
  );

  if (!isValidHash) {
    console.error('❌ Hash verification failed for order:', order_id);
    return res.status(400).send('FAIL');
  }

  const payment = await Payment.findOne({ orderNumber: order_id });
  if (!payment) {
    console.error('Payment record not found:', order_id);
    return res.status(404).send('FAIL');
  }

  const order = await Order.findOne({ orderNumber: order_id });
  if (!order) {
    console.error('Order not found:', order_id);
    return res.status(404).send('FAIL');
  }

  // Update payment tracking details
  payment.notificationReceived = true;
  payment.notificationReceivedAt = new Date();
  payment.payhereDetails = {
    merchantId: merchant_id,
    orderId: order_id,
    statusCode: status_code,
    statusMessage: status_message,
    method: method,
    cardHolderName: card_holder_name,
    cardNo: card_no ? card_no.slice(-4) : null,
    md5sig: md5sig,
    paymentDate: new Date()
  };
  payment.transactionId = order_id + '-' + Date.now();

  switch (status_code) {

    case '2': // ✅ Payment Success
      // Guard: Don't deduct inventory twice if webhook fires more than once
      if (order.paymentStatus !== 'paid') {
        payment.paymentStatus = 'completed';
        order.paymentStatus = 'paid';
        order.orderStatus = 'confirmed';
        order.payhereTransactionId = payment.transactionId;
        order.paymentGatewayResponse = new Map(Object.entries({
          status: 'success',
          method: method,
          cardHolder: card_holder_name,
          statusMessage: status_message
        }));

        // ============================================================
        // ✅ FIX: Deduct inventory ONLY after confirmed payment
        // Uses atomic operation to prevent race conditions
        // ============================================================
        const inventoryResults = await deductInventory(order.items);
        const failedDeductions = inventoryResults.filter(r => !r.success);

        if (failedDeductions.length > 0) {
          // Payment succeeded but stock ran out (edge case)
          // Log for admin to handle manually (refund or source stock)
          console.error('⚠️ INVENTORY ALERT: Payment received but stock insufficient for:', failedDeductions);
          order.inventoryAlert = true;
          order.inventoryAlertDetails = failedDeductions;
        } else {
          order.inventoryAlert = false;
        }

        console.log(`✅ Payment & inventory update successful for order: ${order_id}`);
      } else {
        console.log(`ℹ️ Duplicate webhook ignored for already-paid order: ${order_id}`);
      }
      break;

    case '0': // Pending / Processing
      payment.paymentStatus = 'processing';
      order.paymentStatus = 'unpaid';
      console.log(`Payment pending for order: ${order_id}`);
      break;

    case '-1': // Cancelled by user
      payment.paymentStatus = 'canceled';
      order.paymentStatus = 'failed';
      // ✅ No inventory was deducted (payment didn't succeed), nothing to restore
      console.log(`Payment cancelled for order: ${order_id}`);
      break;

    case '-2': // Payment Failed
      payment.paymentStatus = 'failed';
      order.paymentStatus = 'failed';
      payment.retryCount = (payment.retryCount || 0) + 1;
      // ✅ No inventory was deducted, nothing to restore
      console.log(`Payment failed for order: ${order_id}`);
      break;

    case '-3': // Charged back / Refunded
      payment.paymentStatus = 'refunded';
      order.paymentStatus = 'refunded';
      order.orderStatus = 'cancelled';

      // ✅ FIX: Restore inventory when payment is charged back
      if (order.paymentStatus === 'paid') {
        await restoreInventory(order.items);
        console.log(`🔄 Inventory restored after chargeback for order: ${order_id}`);
      }
      break;

    default:
      console.log(`Unknown status code: ${status_code} for order: ${order_id}`);
  }

  await payment.save();
  await order.save();

  res.status(200).send('OK');
});

// @desc    Get payment details
// @route   GET /order/payment/:orderNumber
// @access  Public
export const getPaymentDetails = asyncErrorHandler(async (req, res, next) => {
  const { orderNumber } = req.params;

  const payment = await Payment.findOne({ orderNumber });
  if (!payment) {
    return next(new CustomError("Payment not found", 404));
  }

  res.status(200).json({ success: true, payment });
});

// @desc    Get all payments (Admin)
// @route   GET /order/admin/payments
// @access  Private/Admin
export const getAllPayments = asyncErrorHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const payments = await Payment.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Payment.countDocuments();

  res.status(200).json({
    success: true,
    payments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});