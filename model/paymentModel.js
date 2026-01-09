
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    ref: 'Order',
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'LKR'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'canceled', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['payhere', 'cod'],
    default: 'payhere'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  payhereDetails: {
    merchantId: String,
    orderId: String,
    statusCode: String,
    statusMessage: String,
    method: String,
    cardHolderName: String,
    cardNo: String,
    md5sig: String,
    paymentDate: Date
  },
  customerDetails: {
    name: String,
    email: String,
    phone: String,
    address: String,
    city: String
  },
  hash: String,
  notificationReceived: {
    type: Boolean,
    default: false
  },
  notificationReceivedAt: Date,
  retryCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

paymentSchema.index({ orderNumber: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;