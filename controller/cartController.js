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
  const sessionId = getOrCreateSessionId(req, res);

  console.log('Cart operation:', { userId, sessionId, hasUser: !!userId });

  if (!userId && !sessionId) {
    const error = new CustomError("Could not identify cart session", 400);
    return next(error);
  }

  // Verify product exists
  const productData = await Product.findById(productId);
  if (!productData) {
    const error = new CustomError("Product not found", 404);
    return next(error);
  }

  // ✅ FIX 1: Check stock availability before adding to cart
  if (productData.item_count <= 0) {
    const error = new CustomError("This product is out of stock", 400);
    return next(error);
  }

  if (productData.item_count < quantity) {
    const error = new CustomError(
      `Only ${productData.item_count} items available in stock`,
      400
    );
    return next(error);
  }

  // Find or create cart
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
  } else {
    cart = await Cart.findOne({ sessionId });
    if (!cart) {
      cart = new Cart({ sessionId, items: [] });
    }
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(
    (item) =>
      item.productId.toString() === productId &&
      item.color === (color || "") &&
      item.size === (size || "")
  );

  if (existingItemIndex > -1) {
    // ✅ FIX 2: Check stock against TOTAL quantity (existing + new)
    const newQuantity = cart.items[existingItemIndex].quantity + parseInt(quantity);

    if (productData.item_count < newQuantity) {
      const error = new CustomError(
        `Only ${productData.item_count} items available. You already have ${cart.items[existingItemIndex].quantity} in your cart.`,
        400
      );
      return next(error);
    }

    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    // Add new item
    cart.items.push({
      productId,
      productName: productData.productName,
      price: productData.price,
      quantity: parseInt(quantity),
      mainImage: productData.mainImage,
      color: color || "",
      size: size || "",
      weight: productData.weight || 0,
      inStock: productData.item_count > 0
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

// @desc    Get cart items with LIVE stock info
// @route   GET /api/cart
// @access  Public
const getCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = getOrCreateSessionId(req, res);

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

  // ✅ FIX 3: Populate LIVE product data so frontend always shows current stock
  const cartItems = await Promise.all(
    cart.items.map(async (item) => {
      try {
        const product = await Product.findById(item.productId).select(
          'productName price mainImage item_count weight category'
        );

        // ✅ FIX 4: Flag items that became out-of-stock since being added to cart
        const currentStock = product ? product.item_count : 0;
        const isAvailable = currentStock >= item.quantity;

        return {
          _id: item._id,
          productId: item.productId,
          productName: product ? product.productName : item.productName,
          price: product ? product.price : item.price,
          mainImage: product ? product.mainImage : item.mainImage,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
          weight: item.weight,
          inStock: currentStock > 0,
          stockCount: currentStock,
          // ✅ NEW: Tell frontend if cart quantity exceeds current stock
          quantityAvailable: isAvailable,
          stockWarning: !isAvailable
            ? currentStock === 0
              ? "This item is now out of stock"
              : `Only ${currentStock} left, but you have ${item.quantity} in cart`
            : null
        };
      } catch (error) {
        console.error('Error fetching product for cart item:', error);
        return {
          ...item.toObject(),
          inStock: false,
          stockWarning: "Unable to verify stock"
        };
      }
    })
  );

  res.status(200).json({
    success: true,
    cart: cartItems,
    cartCount: cartItems.length,
    sessionId,
    // ✅ NEW: Alert frontend if any item has stock issues
    hasStockWarnings: cartItems.some(item => item.stockWarning)
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
  const sessionId = getOrCreateSessionId(req, res);

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

  const cartItemIndex = cart.items.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (cartItemIndex === -1) {
    const error = new CustomError("Item not found in cart", 404);
    return next(error);
  }

  // ✅ Check live stock before updating quantity
  const product = await Product.findById(productId);
  if (!product) {
    const error = new CustomError("Product not found", 404);
    return next(error);
  }

  if (product.item_count < quantity) {
    const error = new CustomError(
      `Only ${product.item_count} items available in stock`,
      400
    );
    return next(error);
  }

  cart.items[cartItemIndex].quantity = parseInt(quantity);
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
  const sessionId = getOrCreateSessionId(req, res);

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

  const initialCount = cart.items.length;
  cart.items = cart.items.filter(
    (item) => item.productId.toString() !== productId
  );

  if (cart.items.length === initialCount) {
    const error = new CustomError("Item not found in cart", 404);
    return next(error);
  }

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
  const sessionId = getOrCreateSessionId(req, res);

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
  const sessionId = getOrCreateSessionId(req, res);

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId });
  }

  const count = cart
    ? cart.items.reduce((total, item) => total + item.quantity, 0)
    : 0;

  res.status(200).json({
    success: true,
    cartCount: count
  });
});

// @desc    Sync guest cart to user cart after login
// @route   POST /api/cart/sync
// @access  Private
const syncCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const sessionId = req.headers['x-session-id'];

  if (!userId) {
    const error = new CustomError("Authentication required", 401);
    return next(error);
  }

  let userCart = await Cart.findOne({ userId });
  let guestCart = null;
  if (sessionId) {
    guestCart = await Cart.findOne({ sessionId });
  }

  if (!userCart) {
    userCart = new Cart({
      userId,
      items: guestCart ? guestCart.items : []
    });
  } else if (guestCart && guestCart.items.length > 0) {
    for (const guestItem of guestCart.items) {
      const existingItemIndex = userCart.items.findIndex(
        (item) => item.productId.toString() === guestItem.productId.toString()
      );

      if (existingItemIndex > -1) {
        userCart.items[existingItemIndex].quantity += guestItem.quantity;
      } else {
        userCart.items.push(guestItem);
      }
    }
  }

  await userCart.save();

  if (guestCart) {
    await Cart.deleteOne({ _id: guestCart._id });
  }

  res.status(200).json({
    success: true,
    cart: userCart.items,
    cartCount: userCart.items.length,
    message: "Cart synced successfully"
  });
});

// @desc    Merge carts
// @route   POST /api/cart/merge
// @access  Private
const mergeCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user?.id || req.user?._id;
  const { sessionId, guestCart } = req.body;

  if (!userId) {
    const error = new CustomError("Authentication required", 401);
    return next(error);
  }

  let userCart = await Cart.findOne({ userId });

  if (!userCart) {
    userCart = new Cart({ userId, items: [] });
  }

  if (guestCart && Array.isArray(guestCart)) {
    for (const guestItem of guestCart) {
      const existingItemIndex = userCart.items.findIndex(
        (item) =>
          item.productId.toString() === guestItem.productId &&
          item.color === guestItem.color &&
          item.size === guestItem.size
      );

      if (existingItemIndex > -1) {
        userCart.items[existingItemIndex].quantity += guestItem.quantity || 1;
      } else {
        userCart.items.push(guestItem);
      }
    }
  }

  await userCart.save();

  if (sessionId) {
    await Cart.deleteOne({ sessionId });
    res.clearCookie('sessionId');
  }

  res.status(200).json({
    success: true,
    cart: userCart.items,
    cartCount: userCart.items.length,
    message: "Cart merged successfully"
  });
});

export {
  addToCart,
  getCart,
  updateCart,
  removeFromCart,
  clearCart,
  getCartCount,
  syncCart,
  mergeCart
};