import Payment from "../model/paymentModel.js";
import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Cart from "../model/cartModel.js";
import Order from "../model/orderModel.js";
import Product from "../model/productModel.js";
import { getOrCreateSessionId } from "../utils/generateSessionId.js";
import crypto from "crypto";

const addOrder = asyncErrorHandler(async (req, res, next) => {
  console.log("📥 Received order request");
  console.log("Body:", req.body);
  console.log("User from auth:", req.user?._id);
  
  const { user, items, total, billDetails } = req.body;
  
  // Validation
  if (!user || !items || !total || !billDetails) {
    console.error("❌ Missing required fields");
    return res.status(400).json({ 
      message: "Missing required fields",
      received: { 
        user: !!user, 
        items: !!items, 
        total: !!total, 
        billDetails: !!billDetails 
      }
    });
  }
  
  if (!Array.isArray(items) || items.length === 0) {
    console.error("❌ Invalid items array");
    return res.status(400).json({ message: "Cart is empty or invalid" });
  }

  if (!Array.isArray(billDetails) || billDetails.length === 0) {
    console.error("❌ Invalid bill details");
    return res.status(400).json({ message: "Billing information is required" });
  }

  // Check delivery option
  const deliveryOption = billDetails[0]?.deliveryOption || "pickup";
  console.log("📦 Delivery Option:", deliveryOption);
  
  try {
    console.log("💾 Creating order in database...");
    
    // Set status based on delivery option
    // Status 1 = Paid (for pickup - no payment needed)
    // Status 1 = Pending (for delivery - awaiting payment)
    const orderStatus = deliveryOption === "pickup" ? 1 : 1; // Both start as status 1
    
    const newOrder = await Payment.create({ 
      user, 
      items, 
      total, 
      billDetails,
      status: orderStatus,
      createdAt: new Date()
    });
    
    console.log("✅ Order created successfully:", newOrder._id);
    console.log("📦 Order Status:", orderStatus, deliveryOption === "pickup" ? "(Pickup - No payment needed)" : "(Delivery - Payment pending)");
    
    return res.status(201).json({ 
      success: true,
      message: deliveryOption === "pickup" 
        ? "Order placed successfully! Please pick up at our office." 
        : "Order created. Redirecting to payment...",
      orderId: newOrder._id,
      deliveryOption: deliveryOption,
      requiresPayment: deliveryOption === "deliver"
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    return res.status(500).json({ 
      message: "Failed to create order",
      error: error.message 
    });
  }
});

const payhereNotify = asyncErrorHandler(async (req, res, next) => {
  console.log("💳 PayHere Notification Received");
  console.log("Payment Details:", req.body);
  
  const paymentDetails = req.body;
  const merchantSecret = process.env.MERCHANT_SECRET;
  const merchantId = paymentDetails.merchant_id;
  const orderId = paymentDetails.order_id;
  const amount = parseFloat(paymentDetails.payhere_amount)
    .toLocaleString("en-us", { minimumFractionDigits: 2 })
    .replace(",", "");
  const currency = paymentDetails.payhere_currency;
  const statusCode = paymentDetails.status_code;

  // Create the hash to verify the integrity
  const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
  const hashString = `${merchantId}${orderId}${amount}${currency}${statusCode}${hashedSecret}`;
  const calculatedHash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

  console.log("🔐 Hash Verification:", {
    received: paymentDetails.md5sig,
    calculated: calculatedHash,
    match: calculatedHash === paymentDetails.md5sig
  });

  if (calculatedHash === paymentDetails.md5sig) {
    console.log("✅ Payment verified successfully");
    console.log("💰 Status Code:", statusCode);
    
    // Status code 2 means successful payment
    if (statusCode === "2" || statusCode === 2) {
      console.log("✅ Payment successful for order:", orderId);
      
      // Update order status to "In Progress" (status 2)
      try {
        await Payment.findOneAndUpdate(
          { _id: orderId },
          { status: 2 }
        );
        console.log("✅ Order status updated to In Progress");
      } catch (error) {
        console.error("❌ Error updating order status:", error);
      }
    }
    
    res.status(200).json({ 
      success: true, 
      message: "Payment verified and processed" 
    });
  } else {
    console.error("❌ Payment verification failed - Hash mismatch");
    res.status(400).json({
      success: false,
      message: "Payment verification failed"
    });
  }
});

const getOrderWithProductDetails = asyncErrorHandler(async (req, res, next) => {
  console.log("📋 Fetching all orders with product details");
  
  const orders = await Payment.find({})
    .sort({ createdAt: -1 })
    .populate("user", "-password")
    .populate({
      path: "items.product",
      model: "product",
      populate: [
        { path: "categoryId", model: "category" },
        { path: "brandId", model: "brand" },
      ],
    });

  console.log(`✅ Found ${orders.length} orders`);
  return res.json(orders);
});

const getOneDetails = asyncErrorHandler(async (req, res, next) => {
  const orderId = req.params.id;
  console.log("🔍 Fetching order details for:", orderId);
  
  const details = await Payment.findById(orderId).populate({
    path: "items.product",
    model: "product",
  });

  if (!details) {
    return res.status(404).json({ message: "Order not found" });
  }

  console.log("✅ Order details found");
  res.json(details);
});

const getOrdersByUser = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  console.log("👤 Fetching orders for user:", userId);
  
  const userOrders = await Payment.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: "items.product",
      model: "product",
    });

  if (!userOrders || userOrders.length === 0) {
    console.log("📭 No orders found for user");
    return res.json([]);
  }

  console.log(`✅ Found ${userOrders.length} orders for user`);
  res.json(userOrders);
});

const updateStatus = asyncErrorHandler(async (req, res, next) => {
  const orderId = req.params.id;
  console.log("🔄 Updating order status for:", orderId);
  
  try {
    const paymentDetails = await Payment.findById(orderId);
    if (!paymentDetails) {
      return res.status(404).json({ message: "Payment details not found" });
    }
    
    const status = paymentDetails.status;
    let newStatus;
    let statusMessage;

    switch (status) {
      case 1:
        newStatus = 2;
        statusMessage = "In Progress";
        break;
      case 2:
        newStatus = 3;
        statusMessage = "Complete";
        break;
      case 3:
        newStatus = 1;
        statusMessage = "Pending";
        break;
      default:
        newStatus = 1;
        statusMessage = "Pending";
    }

    await Payment.findByIdAndUpdate(
      orderId,
      { status: newStatus },
      { new: true }
    );

    console.log(`✅ Status updated to ${statusMessage}`);
    res.status(200).json({ message: `Status updated to ${statusMessage}` });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

export {
  addOrder,
  getOrderWithProductDetails,
  getOneDetails,
  getOrdersByUser,
  payhereNotify,
  updateStatus
};