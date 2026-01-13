
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "product"
  },
  productName: String,
  price: Number,
  quantity: Number,
  mainImage: String,
  color: String,
  size: String,
  weight: Number,
  total: Number
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
      index: true
    },
    // Customer Details
    customerName: {
      type: String,
      required: true
    },
    customerEmail: {
      type: String,
      required: true,
      index: true
    },
    customerPhone: {
      type: String,
      required: true
    },
    // Shipping Address
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    // Order Details
    items: [orderItemSchema],
    subtotal: Number,
    shippingCost: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    // Order Status
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
      index: true
    },
    paymentMethod: {
      type: String,
      enum: ["card", "cod", "payhere"],
      default: "cod",
      required: true
    },
    // Shipping Details
    shippingMethod: {
      type: String,
      enum: ["pickup", "courier", "post"],
      default: "pickup"
    },
    town: {
      type: String,
      default: ""
    },
    // Additional Notes
    orderNotes: String,
    trackingNumber: String,
    sessionId: {
      type: String,
      index: true
    },
    // PayHere Integration Fields
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment"
    },
    payhereTransactionId: String,
    payhereHash: String,
    paymentGatewayResponse: {
      type: Map,
      of: String
    }
  },
  { 
    timestamps: true,
    strict: true
  }
);

// Generate unique order number before validation
orderSchema.pre("validate", function (next) {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
  next();
});

// Add index creation to ensure proper indexing
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model("order", orderSchema);

export default Order;