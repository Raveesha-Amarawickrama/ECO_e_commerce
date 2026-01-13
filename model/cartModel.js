import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  mainImage: {
    type: String
  },
  color: {
    type: String,
    default: ""
  },
  size: {
    type: String,
    default: ""
  },
  weight: {
    type: Number,
    default: 0
  }
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    sessionId: {
      type: String,
      default: null
    },
    items: [cartItemSchema]
  },
  {
    timestamps: true
  }
);

// Validation: Ensure at least ONE identifier exists
cartSchema.pre('save', function(next) {
  if (!this.userId && !this.sessionId) {
    const error = new Error('Cart must have either userId or sessionId');
    return next(error);
  }
  next();
});

// IMPORTANT: Create indexes that allow null values (not unique)
// This prevents duplicate key errors when sessionId or userId is null
cartSchema.index({ userId: 1 }, { sparse: true, unique: false });
cartSchema.index({ sessionId: 1 }, { sparse: true, unique: false });

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;