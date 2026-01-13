import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Cart from "../model/cartModel.js";
import Product from "../model/productModel.js";
import { getOrCreateSessionId } from "../utils/generateSessionId.js";

// @desc    Add product to cart (Works for both Guest and Authenticated users)
// @route   POST /api/cart/add
// @access  Public
const addToCart = asyncErrorHandler(async (req, res, next) => {
  const { productId, quantity, color, size } = req.body;

  // Validate input
  if (!productId || !quantity) {
    const error = new CustomError("Product ID and quantity are required", 400);
    return next(error);
  }

  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req);

  // IMPORTANT: Log to debug
  console.log('Cart operation:', { userId, sessionId, hasUser: !!userId });

  // Ensure we have at least one identifier
  if (!userId && !sessionId) {
    const error = new CustomError("Could not identify cart session", 400);
    return next(error);
  }

  // Verify product exists and get its details
  const productData = await Product.findById(productId);
  if (!productData) {
    const error = new CustomError("Product not found", 404);
    return next(error);
  }

  // Check stock
  if (productData.item_count < quantity) {
    const error = new CustomError(
      `Only ${productData.item_count} items available`,
      400
    );
    return next(error);
  }

  // Find cart - IMPORTANT: Only search by the identifier that exists
  let cart;
  if (userId) {
    // User is logged in - search by userId only
    cart = await Cart.findOne({ userId });
    
    // Create new cart if none exists
    if (!cart) {
      cart = new Cart({ 
        userId,
        items: []
      });
    }
  } else {
    // Guest user - search by sessionId only
    cart = await Cart.findOne({ sessionId });
    
    // Create new cart if none exists
    if (!cart) {
      cart = new Cart({ 
        sessionId,
        items: []
      });
    }
  }

  // Check if item already exists
  const existingItemIndex = cart.items.findIndex(
    (item) =>
      item.productId.toString() === productId &&
      item.color === (color || "") &&
      item.size === (size || "")
  );

  if (existingItemIndex > -1) {
    // Update quantity
    const newQuantity = cart.items[existingItemIndex].quantity + parseInt(quantity);

    if (productData.item_count < newQuantity) {
      const error = new CustomError(
        `Only ${productData.item_count} items available`,
        400
      );
      return next(error);
    }

    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    // Add new item with weight
    cart.items.push({
      productId,
      productName: productData.productName,
      price: productData.price,
      quantity: parseInt(quantity),
      mainImage: productData.mainImage,
      color: color || "",
      size: size || "",
      weight: productData.weight || 0
    });
  }

  await cart.save();

  res.status(200).json({
    success: true,
    message: "Product added to cart",
    sessionId,
    cart: cart.items,
    cartCount: cart.items.length
  });
});

// @desc    Get cart items (Works for both Guest and Authenticated users)
// @route   GET /api/cart
// @access  Public
const getCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req);

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId });
  }

  if (!cart || cart.items.length === 0) {
    return res.status(200).json({
      success: true,
      cart: [],
      cartCount: 0,
      message: "Cart is empty"
    });
  }

  res.status(200).json({
    success: true,
    cart: cart.items,
    cartCount: cart.items.length,
    sessionId
  });
});

// @desc    Update cart item quantity
// @route   POST /api/cart/update
// @access  Public
const updateCart = asyncErrorHandler(async (req, res, next) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity) {
    const error = new CustomError("Product ID and quantity are required", 400);
    return next(error);
  }

  if (quantity < 1) {
    const error = new CustomError("Quantity must be at least 1", 400);
    return next(error);
  }

  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req);

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId });
  }

  if (!cart) {
    const error = new CustomError("Cart not found", 404);
    return next(error);
  }

  const cartItem = cart.items.find(
    (item) => item.productId.toString() === productId
  );

  if (!cartItem) {
    const error = new CustomError("Item not found in cart", 404);
    return next(error);
  }

  // Check stock
  const product = await Product.findById(productId);
  if (product.item_count < quantity) {
    const error = new CustomError(
      `Only ${product.item_count} items available`,
      400
    );
    return next(error);
  }

  cartItem.quantity = parseInt(quantity);
  await cart.save();

  res.status(200).json({
    success: true,
    message: "Cart updated",
    cart: cart.items
  });
});

// @desc    Remove item from cart
// @route   POST /api/cart/remove
// @access  Public
const removeFromCart = asyncErrorHandler(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    const error = new CustomError("Product ID is required", 400);
    return next(error);
  }

  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req);

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId });
  }

  if (!cart) {
    const error = new CustomError("Cart not found", 404);
    return next(error);
  }

  cart.items = cart.items.filter(
    (item) => item.productId.toString() !== productId
  );

  await cart.save();

  res.status(200).json({
    success: true,
    message: "Item removed from cart",
    cart: cart.items,
    cartCount: cart.items.length
  });
});

// @desc    Clear entire cart
// @route   POST /api/cart/clear
// @access  Public
const clearCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req);

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId });
  }

  if (!cart) {
    const error = new CustomError("Cart not found", 404);
    return next(error);
  }

  cart.items = [];
  await cart.save();

  res.status(200).json({
    success: true,
    message: "Cart cleared",
    cart: []
  });
});

// @desc    Get cart count
// @route   GET /api/cart/count
// @access  Public
const getCartCount = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req);

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId });
  }

  const count = cart ? cart.items.length : 0;

  res.status(200).json({
    success: true,
    cartCount: count
  });
});

// @desc    Sync guest cart to user cart after login
// @route   POST /api/cart/sync
// @access  Private (requires authentication)
const syncCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = req.headers['x-session-id'];

  if (!userId) {
    const error = new CustomError("Authentication required", 401);
    return next(error);
  }

  if (!sessionId) {
    // No session cart to sync, just return user cart
    const userCart = await Cart.findOne({ userId });
    return res.status(200).json({
      success: true,
      cart: userCart ? userCart.items : [],
      message: "No session cart to sync"
    });
  }

  // Find session cart (guest cart)
  const sessionCart = await Cart.findOne({ sessionId });

  if (!sessionCart || sessionCart.items.length === 0) {
    // No items in session cart, just return user cart
    const userCart = await Cart.findOne({ userId });
    return res.status(200).json({
      success: true,
      cart: userCart ? userCart.items : [],
      message: "Session cart is empty"
    });
  }

  // Find or create user cart
  let userCart = await Cart.findOne({ userId });

  if (!userCart) {
    // Create new cart for user with session items
    userCart = new Cart({
      userId,
      items: sessionCart.items
    });
    await userCart.save();
  } else {
    // Merge session cart into user cart
    for (const sessionItem of sessionCart.items) {
      const existingItemIndex = userCart.items.findIndex(
        (item) =>
          item.productId.toString() === sessionItem.productId.toString() &&
          item.color === sessionItem.color &&
          item.size === sessionItem.size
      );

      if (existingItemIndex > -1) {
        // Update quantity if item exists
        userCart.items[existingItemIndex].quantity += sessionItem.quantity;
      } else {
        // Add new item
        userCart.items.push(sessionItem);
      }
    }
    await userCart.save();
  }

  // Delete session cart after successful sync
  await Cart.deleteOne({ sessionId });

  res.status(200).json({
    success: true,
    cart: userCart.items,
    cartCount: userCart.items.length,
    message: "Cart synced successfully"
  });
});

export {
  addToCart,
  getCart,
  updateCart,
  removeFromCart,
  clearCart,
  getCartCount,
  syncCart
};