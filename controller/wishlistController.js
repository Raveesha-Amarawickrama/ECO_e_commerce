import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Wishlist from "../model/wishlistModel.js";
import Product from "../model/productModel.js";
import { getOrCreateSessionId } from "../utils/generateSessionId.js";

// Helper function to get userId or sessionId
const getWishlistIdentifier = (req) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req);
  return { userId, sessionId };
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add
// @access  Public
const addToWishlist = asyncErrorHandler(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    const error = new CustomError("Product ID is required", 400);
    return next(error);
  }

  const { userId, sessionId } = getWishlistIdentifier(req);

  // Verify product exists
  const product = await Product.findById(productId);
  if (!product) {
    const error = new CustomError("Product not found", 404);
    return next(error);
  }

  // Find wishlist based on userId or sessionId
  let wishlist;
  if (userId) {
    wishlist = await Wishlist.findOne({ userId });
  } else {
    wishlist = await Wishlist.findOne({ sessionId });
  }

  if (!wishlist) {
    wishlist = new Wishlist({
      ...(userId ? { userId } : { sessionId }),
      items: []
    });
  }

  // Check if product already in wishlist
  const exists = wishlist.items.find(
    (item) => item.productId.toString() === productId
  );

  if (exists) {
    return res.status(200).json({
      success: true,
      message: "Product already in wishlist",
      wishlist: wishlist.items
    });
  }

  // Add product to wishlist
  wishlist.items.push({
    productId,
    productName: product.productName,
    price: product.price,
    mainImage: product.mainImage
  });

  await wishlist.save();

  res.status(200).json({
    success: true,
    message: "Product added to wishlist",
    wishlist: wishlist.items,
    wishlistCount: wishlist.items.length
  });
});

// @desc    Get wishlist items
// @route   GET /api/wishlist
// @access  Public
const getWishlist = asyncErrorHandler(async (req, res, next) => {
  const { userId, sessionId } = getWishlistIdentifier(req);

  let wishlist;
  if (userId) {
    wishlist = await Wishlist.findOne({ userId }).populate('items.productId');
  } else {
    wishlist = await Wishlist.findOne({ sessionId }).populate('items.productId');
  }

  if (!wishlist || wishlist.items.length === 0) {
    return res.status(200).json({
      success: true,
      wishlist: [],
      wishlistCount: 0,
      message: "Wishlist is empty"
    });
  }

  // Map items to include full product details
  const items = wishlist.items.map(item => {
    const productData = item.productId;
    return {
      _id: productData._id,
      productId: productData._id,
      productName: productData.productName,
      price: productData.price,
      mainImage: productData.mainImage,
      description: productData.description,
      category: productData.category
    };
  });

  res.status(200).json({
    success: true,
    wishlist: items,
    wishlistCount: items.length
  });
});

// @desc    Remove item from wishlist
// @route   POST /api/wishlist/remove
// @access  Public
const removeFromWishlist = asyncErrorHandler(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    const error = new CustomError("Product ID is required", 400);
    return next(error);
  }

  const { userId, sessionId } = getWishlistIdentifier(req);

  let wishlist;
  if (userId) {
    wishlist = await Wishlist.findOne({ userId });
  } else {
    wishlist = await Wishlist.findOne({ sessionId });
  }

  if (!wishlist) {
    const error = new CustomError("Wishlist not found", 404);
    return next(error);
  }

  wishlist.items = wishlist.items.filter(
    (item) => item.productId.toString() !== productId
  );

  await wishlist.save();

  res.status(200).json({
    success: true,
    message: "Item removed from wishlist",
    wishlist: wishlist.items,
    wishlistCount: wishlist.items.length
  });
});

// @desc    Clear entire wishlist
// @route   POST /api/wishlist/clear
// @access  Public
const clearWishlist = asyncErrorHandler(async (req, res, next) => {
  const { userId, sessionId } = getWishlistIdentifier(req);

  let wishlist;
  if (userId) {
    wishlist = await Wishlist.findOne({ userId });
  } else {
    wishlist = await Wishlist.findOne({ sessionId });
  }

  if (!wishlist) {
    const error = new CustomError("Wishlist not found", 404);
    return next(error);
  }

  wishlist.items = [];
  await wishlist.save();

  res.status(200).json({
    success: true,
    message: "Wishlist cleared",
    wishlist: []
  });
});

// @desc    Get wishlist count
// @route   GET /api/wishlist/count
// @access  Public
const getWishlistCount = asyncErrorHandler(async (req, res, next) => {
  const { userId, sessionId } = getWishlistIdentifier(req);

  let wishlist;
  if (userId) {
    wishlist = await Wishlist.findOne({ userId });
  } else {
    wishlist = await Wishlist.findOne({ sessionId });
  }

  const count = wishlist ? wishlist.items.length : 0;

  res.status(200).json({
    success: true,
    wishlistCount: count
  });
});

// @desc    Sync guest wishlist to user wishlist after login
// @route   POST /api/wishlist/sync
// @access  Private
const syncWishlist = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = req.headers['x-session-id'];

  if (!userId) {
    const error = new CustomError("Authentication required", 401);
    return next(error);
  }

  if (!sessionId) {
    const userWishlist = await Wishlist.findOne({ userId });
    return res.status(200).json({
      success: true,
      wishlist: userWishlist ? userWishlist.items : [],
      message: "No session wishlist to sync"
    });
  }

  // Find session wishlist (guest wishlist)
  const sessionWishlist = await Wishlist.findOne({ sessionId });

  if (!sessionWishlist || sessionWishlist.items.length === 0) {
    const userWishlist = await Wishlist.findOne({ userId });
    return res.status(200).json({
      success: true,
      wishlist: userWishlist ? userWishlist.items : [],
      message: "Session wishlist is empty"
    });
  }

  // Find or create user wishlist
  let userWishlist = await Wishlist.findOne({ userId });

  if (!userWishlist) {
    userWishlist = new Wishlist({
      userId,
      items: sessionWishlist.items
    });
    await userWishlist.save();
  } else {
    // Merge session wishlist into user wishlist
    for (const sessionItem of sessionWishlist.items) {
      const exists = userWishlist.items.find(
        (item) => item.productId.toString() === sessionItem.productId.toString()
      );

      if (!exists) {
        userWishlist.items.push(sessionItem);
      }
    }
    await userWishlist.save();
  }

  // Delete session wishlist after successful sync
  await Wishlist.deleteOne({ sessionId });

  res.status(200).json({
    success: true,
    wishlist: userWishlist.items,
    wishlistCount: userWishlist.items.length,
    message: "Wishlist synced successfully"
  });
});

export {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  clearWishlist,
  getWishlistCount,
  syncWishlist
};