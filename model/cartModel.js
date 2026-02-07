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
    min: 1,
    default: 1
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
  },
  inStock: {
    type: Boolean,
    default: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true
    },
    sessionId: {
      type: String,
      sparse: true
    },
    items: [cartItemSchema],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
cartSchema.index({ userId: 1, sessionId: 1 });

// Auto-update lastUpdated timestamp
cartSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Validation: Ensure at least ONE identifier exists
cartSchema.pre('save', function(next) {
  if (!this.userId && !this.sessionId) {
    const error = new Error('Cart must have either userId or sessionId');
    return next(error);
  }
  
  // Remove duplicates based on productId, color, and size
  const seen = new Set();
  this.items = this.items.filter(item => {
    const key = `${item.productId}-${item.color}-${item.size}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  
  next();
});

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;