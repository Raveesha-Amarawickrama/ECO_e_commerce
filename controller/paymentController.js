import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Payment from "../model/paymentModel.js";
import Order from "../model/orderModel.js";
import crypto from "crypto";

// Helper: Generate PayHere hash
const generatePayHereHash = (merchantId, orderId, amount, currency, merchantSecret) => {
  if (!merchantId || !orderId || !amount || !currency || !merchantSecret) {
    console.error('Missing hash generation parameters:', {
      merchantId: !!merchantId,
      orderId: !!orderId,
      amount: !!amount,
      currency: !!currency,
      merchantSecret: !!merchantSecret
    });
    throw new Error('Missing required parameters for hash generation');
  }

  const hashedSecret = crypto
    .createHash('md5')
    .update(String(merchantSecret))
    .digest('hex')
    .toUpperCase();
  
  const amountFormatted = parseFloat(amount).toFixed(2);
  const hashInput = String(merchantId) + String(orderId) + String(amountFormatted) + String(currency) + String(hashedSecret);
  
  console.log('Hash generation input:', {
    merchantId: String(merchantId),
    orderId: String(orderId),
    amount: String(amountFormatted),
    currency: String(currency),
    hashedSecretLength: hashedSecret.length
  });
  
  const hash = crypto
    .createHash('md5')
    .update(hashInput)
    .digest('hex')
    .toUpperCase();
  
  return hash;
};

// Helper: Verify PayHere hash
const verifyPayHereHash = (merchantId, orderId, amount, currency, statusCode, md5sig, merchantSecret) => {
  const hashedSecret = crypto
    .createHash('md5')
    .update(String(merchantSecret))
    .digest('hex')
    .toUpperCase();
  
  const localHash = crypto
    .createHash('md5')
    .update(String(merchantId) + String(orderId) + String(amount) + String(currency) + String(statusCode) + String(hashedSecret))
    .digest('hex')
    .toUpperCase();

  return localHash === md5sig;
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

  console.log('Payment initiation request:', {
    orderNumber,
    amount,
    customerName,
    customerEmail
  });

  // Validate required fields
  if (!amount || !customerName || !customerEmail) {
    const error = new CustomError("Missing required payment information", 400);
    return next(error);
  }

  // Get environment variables
  const PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
  const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

  console.log('Environment check:', {
    merchantIdExists: !!PAYHERE_MERCHANT_ID,
    merchantSecretExists: !!PAYHERE_MERCHANT_SECRET,
    merchantIdValue: PAYHERE_MERCHANT_ID ? `${PAYHERE_MERCHANT_ID.substring(0, 3)}...` : 'undefined',
    nodeEnv: process.env.NODE_ENV
  });

  // Validate environment variables
  if (!PAYHERE_MERCHANT_ID || !PAYHERE_MERCHANT_SECRET) {
    console.error('PayHere configuration missing:', {
      merchantId: !!PAYHERE_MERCHANT_ID,
      merchantSecret: !!PAYHERE_MERCHANT_SECRET,
      allEnvKeys: Object.keys(process.env).filter(k => k.includes('PAYHERE'))
    });
    const error = new CustomError("Payment gateway not configured properly. Please contact support.", 500);
    return next(error);
  }

  // Find the order
  const order = await Order.findOne({ orderNumber });
  
  if (!order) {
    console.error('Order not found:', orderNumber);
    const error = new CustomError("Order not found", 404);
    return next(error);
  }

  console.log('Order found:', {
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus
  });

  // Verify amount matches order total
  const requestedAmount = parseFloat(amount);
  const orderAmount = parseFloat(order.totalAmount);
  
  if (isNaN(requestedAmount) || isNaN(orderAmount)) {
    const error = new CustomError("Invalid amount format", 400);
    return next(error);
  }

  if (Math.abs(requestedAmount - orderAmount) > 0.01) {
    console.error('Amount mismatch:', {
      requested: requestedAmount,
      order: orderAmount
    });
    const error = new CustomError("Payment amount does not match order total", 400);
    return next(error);
  }

  // Check if order is already paid
  if (order.paymentStatus === 'paid') {
    const error = new CustomError("Order is already paid", 400);
    return next(error);
  }

  // Check if payment already exists
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
    // Generate hash for PayHere
    const hash = generatePayHereHash(
      PAYHERE_MERCHANT_ID,
      orderNumber,
      orderAmount,
      'LKR',
      PAYHERE_MERCHANT_SECRET
    );

    console.log('Hash generated successfully:', hash.substring(0, 10) + '...');

    payment.hash = hash;
    payment.paymentStatus = 'processing';
    await payment.save();

    // Update order with payment reference
    order.paymentId = payment._id;
    order.payhereHash = hash;
    order.paymentMethod = 'payhere';
    await order.save();

    console.log('Payment initiation successful');

    res.status(200).json({
      success: true,
      merchant_id: PAYHERE_MERCHANT_ID,
      hash: hash,
      orderId: orderNumber,
      amount: orderAmount.toFixed(2)
    });
  } catch (hashError) {
    console.error('Hash generation error:', hashError);
    const error = new CustomError("Failed to generate payment hash: " + hashError.message, 500);
    return next(error);
  }
});

// @desc    PayHere notification webhook
// @route   POST /order/payment/notify
// @access  Public (but secured with hash verification)
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

  console.log('PayHere Notification Received:', {
    order_id,
    status_code,
    status_message,
    method
  });

  // Get merchant secret from environment
  const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

  if (!PAYHERE_MERCHANT_SECRET) {
    console.error('Merchant secret not configured for webhook');
    return res.status(500).send('FAIL');
  }

  // Verify the hash
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
    console.error('Hash verification failed');
    return res.status(400).send('FAIL');
  }

  // Find payment record
  const payment = await Payment.findOne({ orderNumber: order_id });
  
  if (!payment) {
    console.error('Payment record not found for order:', order_id);
    return res.status(404).send('FAIL');
  }

  // Find associated order
  const order = await Order.findOne({ orderNumber: order_id });
  
  if (!order) {
    console.error('Order not found:', order_id);
    return res.status(404).send('FAIL');
  }

  // Update payment details
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

  // Handle different status codes
  switch (status_code) {
    case '2': // Success
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
      console.log(`Payment successful for order: ${order_id}`);
      break;

    case '0': // Pending
      payment.paymentStatus = 'processing';
      order.paymentStatus = 'unpaid';
      console.log(`Payment pending for order: ${order_id}`);
      break;

    case '-1': // Canceled
      payment.paymentStatus = 'canceled';
      order.paymentStatus = 'failed';
      console.log(`Payment canceled for order: ${order_id}`);
      break;

    case '-2': // Failed
      payment.paymentStatus = 'failed';
      order.paymentStatus = 'failed';
      payment.retryCount += 1;
      console.log(`Payment failed for order: ${order_id}`);
      break;

    case '-3': // Charged back
      payment.paymentStatus = 'refunded';
      order.paymentStatus = 'refunded';
      order.orderStatus = 'cancelled';
      console.log(`Payment charged back for order: ${order_id}`);
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
    const error = new CustomError("Payment not found", 404);
    return next(error);
  }

  res.status(200).json({ 
    success: true, 
    payment 
  });
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