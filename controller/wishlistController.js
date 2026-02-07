// controller/wishlistController.js
import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Wishlist from "../model/wishlistModel.js";
import Product from "../model/productModel.js";

// @desc    Add product to wishlist (requires authentication)
// @route   POST /api/wishlist/add
// @access  Private
export const addToWishlist = asyncErrorHandler(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    const error = new CustomError("Product ID is required", 400);
    return next(error);
  }

  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    const error = new CustomError("Authentication required for wishlist", 401);
    return next(error);
  }

  // Verify product exists
  const product = await Product.findById(productId);
  if (!product) {
    const error = new CustomError("Product not found", 404);
    return next(error);
  }

  // Find or create wishlist for user
  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    wishlist = new Wishlist({
      userId,
      items: []
    });
  }

  // Check if product already in wishlist
  const exists = wishlist.items.find(
    (item) => item.productId.toString() === productId.toString()
  );

  if (exists) {
    // Product already exists - return current wishlist
    const populatedWishlist = await Wishlist.findOne({ userId }).populate({
      path: 'items.productId',
      select: '_id productName price mainImage description category stock images'
    });

    const items = populatedWishlist.items
      .map(item => {
        if (item.productId && item.productId._id) {
          return {
            _id: item.productId._id,
            productId: item.productId._id,
            productName: item.productId.productName,
            price: item.productId.price,
            mainImage: item.productId.mainImage,
            description: item.productId.description || '',
            category: item.productId.category || '',
            stock: item.productId.stock || 0
          };
        }
        return null;
      })
      .filter(item => item !== null);

    return res.status(200).json({
      success: true,
      message: "Product already in wishlist",
      wishlist: items,
      wishlistCount: items.length
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

  // Populate and return updated wishlist
  const populatedWishlist = await Wishlist.findOne({ userId }).populate({
    path: 'items.productId',
    select: '_id productName price mainImage description category stock images'
  });

  const items = populatedWishlist.items
    .map(item => {
      if (item.productId && item.productId._id) {
        return {
          _id: item.productId._id,
          productId: item.productId._id,
          productName: item.productId.productName,
          price: item.productId.price,
          mainImage: item.productId.mainImage,
          description: item.productId.description || '',
          category: item.productId.category || '',
          stock: item.productId.stock || 0
        };
      }
      return null;
    })
    .filter(item => item !== null);

  res.status(200).json({
    success: true,
    message: "Product added to wishlist",
    wishlist: items,
    wishlistCount: items.length
  });
});

// @desc    Get wishlist items (requires authentication)
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    const error = new CustomError("Authentication required for wishlist", 401);
    return next(error);
  }

  // Find wishlist and populate products
  let wishlist = await Wishlist.findOne({ userId }).populate({
    path: 'items.productId',
    select: '_id productName price mainImage description category stock images'
  });

  if (!wishlist || wishlist.items.length === 0) {
    return res.status(200).json({
      success: true,
      wishlist: [],
      wishlistCount: 0,
      message: "Wishlist is empty"
    });
  }

  // Map items and handle deleted products gracefully
  const items = wishlist.items
    .map(item => {
      // Check if product still exists (wasn't deleted)
      if (item.productId && item.productId._id) {
        // Product exists - use fresh data from DB
        return {
          _id: item.productId._id,
          productId: item.productId._id,
          productName: item.productId.productName,
          price: item.productId.price,
          mainImage: item.productId.mainImage,
          description: item.productId.description || '',
          category: item.productId.category || '',
          stock: item.productId.stock || 0,
          images: item.productId.images || []
        };
      } else if (item.productId) {
        // Product was deleted but we have cached data
        console.log(`Product ${item.productId} was deleted, using cached data`);
        return {
          _id: item.productId,
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          mainImage: item.mainImage,
          description: '',
          category: '',
          isDeleted: true
        };
      }
      return null;
    })
    .filter(item => item !== null);

  res.status(200).json({
    success: true,
    wishlist: items,
    wishlistCount: items.length
  });
});

// @desc    Remove item from wishlist
// @route   POST /api/wishlist/remove
// @access  Private
export const removeFromWishlist = asyncErrorHandler(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    const error = new CustomError("Product ID is required", 400);
    return next(error);
  }

  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    const error = new CustomError("Authentication required for wishlist", 401);
    return next(error);
  }

  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    const error = new CustomError("Wishlist not found", 404);
    return next(error);
  }

  // Filter out the item
  const originalLength = wishlist.items.length;
  wishlist.items = wishlist.items.filter(
    (item) => item.productId.toString() !== productId.toString()
  );

  if (wishlist.items.length === originalLength) {
    return res.status(404).json({
      success: false,
      message: "Item not found in wishlist"
    });
  }

  await wishlist.save();

  // Return updated items with product details
  const updatedWishlist = await Wishlist.findOne({ userId }).populate({
    path: 'items.productId',
    select: '_id productName price mainImage description category stock'
  });

  const items = updatedWishlist.items
    .map(item => {
      if (item.productId && item.productId._id) {
        return {
          _id: item.productId._id,
          productId: item.productId._id,
          productName: item.productId.productName,
          price: item.productId.price,
          mainImage: item.productId.mainImage,
          description: item.productId.description || '',
          category: item.productId.category || '',
          stock: item.productId.stock || 0
        };
      }
      return null;
    })
    .filter(item => item !== null);

  res.status(200).json({
    success: true,
    message: "Item removed from wishlist",
    wishlist: items,
    wishlistCount: items.length
  });
});

// @desc    Clear entire wishlist
// @route   POST /api/wishlist/clear
// @access  Private
export const clearWishlist = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    const error = new CustomError("Authentication required for wishlist", 401);
    return next(error);
  }

  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    const error = new CustomError("Wishlist not found", 404);
    return next(error);
  }

  wishlist.items = [];
  await wishlist.save();

  res.status(200).json({
    success: true,
    message: "Wishlist cleared",
    wishlist: [],
    wishlistCount: 0
  });
});

// @desc    Get wishlist count
// @route   GET /api/wishlist/count
// @access  Private
export const getWishlistCount = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    const error = new CustomError("Authentication required for wishlist", 401);
    return next(error);
  }

  const wishlist = await Wishlist.findOne({ userId });
  const count = wishlist ? wishlist.items.length : 0;

  res.status(200).json({
    success: true,
    wishlistCount: count
  });
});

// @desc    Sync wishlist after login
// @route   POST /api/wishlist/sync
// @access  Private
export const syncWishlist = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    const error = new CustomError("Authentication required", 401);
    return next(error);
  }

  const userWishlist = await Wishlist.findOne({ userId }).populate({
    path: 'items.productId',
    select: '_id productName price mainImage description category stock'
  });

  if (!userWishlist || userWishlist.items.length === 0) {
    return res.status(200).json({
      success: true,
      wishlist: [],
      wishlistCount: 0,
      message: "Wishlist loaded"
    });
  }

  const items = userWishlist.items
    .map(item => {
      if (item.productId && item.productId._id) {
        return {
          _id: item.productId._id,
          productId: item.productId._id,
          productName: item.productId.productName,
          price: item.productId.price,
          mainImage: item.productId.mainImage,
          description: item.productId.description || '',
          category: item.productId.category || '',
          stock: item.productId.stock || 0
        };
      }
      return null;
    })
    .filter(item => item !== null);

  return res.status(200).json({
    success: true,
    wishlist: items,
    wishlistCount: items.length,
    message: "Wishlist loaded"
  });
});

// @desc    Clean up deleted products from wishlist
// @route   POST /api/wishlist/cleanup
// @access  Private
export const cleanupWishlist = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;

  if (!userId) {
    const error = new CustomError("Authentication required", 401);
    return next(error);
  }

  const wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    return res.status(200).json({
      success: true,
      message: "No wishlist found",
      wishlistCount: 0
    });
  }

  // Check each product exists
  const validItems = [];
  for (const item of wishlist.items) {
    const productExists = await Product.findById(item.productId);
    if (productExists) {
      validItems.push(item);
    }
  }

  const removedCount = wishlist.items.length - validItems.length;
  wishlist.items = validItems;
  await wishlist.save();

  res.status(200).json({
    success: true,
    message: `Cleaned up ${removedCount} deleted product(s)`,
    wishlistCount: validItems.length
  });
});