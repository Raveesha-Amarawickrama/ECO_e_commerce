import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema({
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
  mainImage: {
    type: String
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const wishlistSchema = new mongoose.Schema(
  {
    // Either userId OR sessionId will be present
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true
    },
    sessionId: {
      type: String,
      sparse: true
    },
    items: [wishlistItemSchema]
  },
  {
    timestamps: true
  }
);

// Ensure either userId or sessionId is present
wishlistSchema.pre('save', function(next) {
  if (!this.userId && !this.sessionId) {
    next(new Error('Wishlist must have either userId or sessionId'));
  } else {
    next();
  }
});

// Index for faster queries
wishlistSchema.index({ userId: 1 });
wishlistSchema.index({ sessionId: 1 });

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;