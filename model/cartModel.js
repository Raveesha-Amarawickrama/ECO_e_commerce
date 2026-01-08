import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "product",
    required: true
  },
  productName: String,
  price: Number,
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  mainImage: String,
  color: String,
  size: String,
  weight: Number, // Add weight field to store item weight
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    items: [cartItemSchema],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      index: { expires: 0 } // Auto-delete after expiration
    }
  },
  { timestamps: true }
);

const Cart = mongoose.model("cart", cartSchema);

export default Cart;