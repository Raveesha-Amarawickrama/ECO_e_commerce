// model/wishlistModel.js
import mongoose from "mongoose";

// ⚠️ CRITICAL: Don't import Product model here - it causes circular dependency
// Instead, use ref: "Product" and let Mongoose handle the population

const wishlistItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product", // String reference, not direct import
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    items: [wishlistItemSchema]
  },
  {
    timestamps: true
  }
);

// Index for faster queries
wishlistSchema.index({ userId: 1 });

// Virtual for item count
wishlistSchema.virtual('itemCount').get(function() {
  return this.items.length;
});

// Method to check if product exists in wishlist
wishlistSchema.methods.hasProduct = function(productId) {
  return this.items.some(item => 
    item.productId.toString() === productId.toString()
  );
};

// Method to add product to wishlist
wishlistSchema.methods.addProduct = function(productData) {
  if (!this.hasProduct(productData._id)) {
    this.items.push({
      productId: productData._id,
      productName: productData.productName,
      price: productData.price,
      mainImage: productData.mainImage
    });
  }
  return this;
};

// Method to remove product from wishlist
wishlistSchema.methods.removeProduct = function(productId) {
  this.items = this.items.filter(
    item => item.productId.toString() !== productId.toString()
  );
  return this;
};

// Method to clear all items
wishlistSchema.methods.clearItems = function() {
  this.items = [];
  return this;
};

// Static method to get or create wishlist for user
wishlistSchema.statics.getOrCreateForUser = async function(userId) {
  let wishlist = await this.findOne({ userId });
  
  if (!wishlist) {
    wishlist = await this.create({
      userId,
      items: []
    });
  }
  
  return wishlist;
};

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;