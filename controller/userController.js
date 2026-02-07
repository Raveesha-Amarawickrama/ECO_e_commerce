import user from "../model/userModel.js";
import bcrypt from "bcryptjs";
import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import jwt from "jsonwebtoken";
import { CustomError } from "../utils/customerError.js";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";

const singToken = (id, name) => {
  return jwt.sign({ id, name }, process.env.JWT_SECRET, {
    expiresIn: "1hr",
  });
};

const registerUser = asyncErrorHandler(async (req, res, next) => {
  const { name, username, phoneNo, password, role } = req.body;
  
  // Check validation
  if (!name) {
    const error = new CustomError("Enter the user name", 400);
    return next(error);
  }
  if (!password || password.length < 8) {
    const error = new CustomError("Password must be at least 8 characters long", 400);
    return next(error);
  }
  
  // Check if user already exists
  const exits = await user.findOne({ username });
  if (exits) {
    const error = new CustomError("User already exists. Please use a different email.", 409);
    return next(error);
  }
  
  bcrypt.genSalt(10, function (err, salt) {
    if (err) {
      const error = new CustomError("Hash error", 500);
      return next(error);
    }
    bcrypt.hash(password, salt, async function (err, hash) {
      if (err) {
        const error = new CustomError("Hash error", 500);
        return next(error);
      }
      
      // Create new user
      const userCreate = await user.create({
        name,
        username,
        phoneNo,
        password: hash,
        role: role || 'user',
        verified: true,     // Allow immediate login
        isActive: true,     // Ensure user is active
      });

      // Generate JWT token
      const token = singToken(userCreate._id, userCreate.username);

      // Get user without password
      const newUser = await user.findById(userCreate._id).select("-password");

      // Set cookie
      res.cookie("token", token, {
        httpOnly: true,
        path: "/",
        expires: new Date(Date.now() + 1000 * 86400),
        sameSite: "lax",
      });

      // Return user and token (matching login response format)
      res.status(201).json({ 
        token,
        newUser,
        message: "Account created successfully" 
      });
    });
  });
});

const verifyGmail = asyncErrorHandler(async (req, res, next) => {
  try {
    const token = req.params.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Update user's verified status
    await user.findByIdAndUpdate(decoded.userId, { verified: true });

    res.send("Email successfully verified.");
  } catch (error) {
    res.status(400).send("Invalid or expired token.");
  }
});

const loginUser = asyncErrorHandler(async (req, res, next) => {
  const { username, password } = req.body;
  
  // ✅ Check if username and password are provided
  if (!username || !password) {
    const error = new CustomError("Please provide email and password", 400);
    return next(error);
  }

  const userFind = await user.findOne({ username });
  
  if (!userFind) {
    const error = new CustomError("Invalid Credentials", 404);
    return next(error);
  }
  
  // ✅ Check if user is verified
  if (userFind && !userFind.verified) {
    const error = new CustomError("Please verify your email", 404);
    return next(error);
  }

  // ✅ Check if user is active
  if (userFind && !userFind.isActive) {
    const error = new CustomError("Not Allowed to access", 404);
    return next(error);
  }

  bcrypt.compare(password, userFind.password, async function (err, result) {
    if (err) {
      const error = new CustomError("Internal Server Error", 500);
      return next(error);
    }
    if (result) {
      const newUser = await user.findOne({ username }).select("-password");
      const token = singToken(userFind._id, userFind.username);
      res.cookie("token", token, {
        httpOnly: true,
        path: "/",
        expires: new Date(Date.now() + 1000 * 86400),
        sameSite: "lax",
      });
      res.status(200).json({ token, newUser });
    } else {
      const error = new CustomError("Invalid Credentials", 401);
      return next(error);
    }
  });
});

const getUser = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user;
  let newuser;

  try {
    newuser = await user.findById(userId, "-password");
  } catch (err) {
    const error = new CustomError("Login again..", 500);
    return next(error);
  }
  
  if (!newuser) {
    return res.status(404).json({ messsage: "User Not Found" });
  }
  
  return res.status(200).json({ newuser });
});

const getAllDetailsUser = asyncErrorHandler(async (req, res, next) => {
  const userDetails = await user.find({}).select("-password");
  res.status(200).json(userDetails);
});

const logOutUser = asyncErrorHandler(async (req, res, next) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "log out" });
});

// ========================================
// USER MANAGEMENT - DELETE USER
// ========================================
const deleteUser = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.id;

  // Prevent deleting yourself
  if (userId === req.user) {
    const error = new CustomError("You cannot delete your own account", 400);
    return next(error);
  }

  const userDoc = await user.findById(userId);

  if (!userDoc) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  // Soft delete - set isActive to false instead of actually deleting
  userDoc.isActive = false;
  await userDoc.save();

  res.status(200).json({ 
    message: "ok",
    success: true 
  });
});

// ========================================
// PASSWORD RESET FUNCTIONS
// ========================================

// Forgot Password - Send reset email
const forgotPassword = asyncErrorHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    const error = new CustomError("Please provide your email", 400);
    return next(error);
  }

  // Find user by email (username)
  const userDoc = await user.findOne({ username: email });

  if (!userDoc) {
    const error = new CustomError("No user found with this email", 404);
    return next(error);
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash token before saving to database
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Save hashed token and expiry to user
  userDoc.resetPasswordToken = hashedToken;
  userDoc.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now

  await userDoc.save();

  // Create reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  // Email message
  const message = `
    <h2>Password Reset Request</h2>
    <p>Hello ${userDoc.name},</p>
    <p>You requested to reset your password. Please click the link below to reset your password:</p>
    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2a9d8f; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <br>
    <p>Best regards,<br>House of Cambridge Team</p>
  `;

  try {
    await sendEmail({
      email: userDoc.username,
      subject: "Password Reset Request",
      message,
    });

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    // Clear reset token if email fails
    userDoc.resetPasswordToken = undefined;
    userDoc.resetPasswordExpires = undefined;
    await userDoc.save();

    const err = new CustomError("Error sending email. Please try again later.", 500);
    return next(err);
  }
});

// Reset Password - Update password with token
const resetPassword = asyncErrorHandler(async (req, res, next) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  // Validate passwords
  if (!password || !confirmPassword) {
    const error = new CustomError("Please provide password and confirm password", 400);
    return next(error);
  }

  if (password !== confirmPassword) {
    const error = new CustomError("Passwords do not match", 400);
    return next(error);
  }

  if (password.length < 8) {
    const error = new CustomError("Password must be at least 8 characters long", 400);
    return next(error);
  }

  // Hash the token from URL
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Find user with valid token and not expired
  const userDoc = await user.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!userDoc) {
    const error = new CustomError("Invalid or expired reset token", 400);
    return next(error);
  }

  // Hash new password
  bcrypt.genSalt(10, function (err, salt) {
    if (err) {
      const error = new CustomError("Error processing password", 500);
      return next(error);
    }
    
    bcrypt.hash(password, salt, async function (err, hash) {
      if (err) {
        const error = new CustomError("Error processing password", 500);
        return next(error);
      }

      // Update password and clear reset token
      userDoc.password = hash;
      userDoc.resetPasswordToken = undefined;
      userDoc.resetPasswordExpires = undefined;

      await userDoc.save();

      // Send confirmation email
      const message = `
        <h2>Password Reset Successful</h2>
        <p>Hello ${userDoc.name},</p>
        <p>Your password has been successfully reset.</p>
        <p>If you did not make this change, please contact us immediately.</p>
        <br>
        <p>Best regards,<br>House of Cambridge Team</p>
      `;

      try {
        await sendEmail({
          email: userDoc.username,
          subject: "Password Reset Successful",
          message,
        });
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
      }

      res.status(200).json({
        success: true,
        message: "Password reset successful. You can now login with your new password.",
      });
    });
  });
});

// ========================================
// CART FUNCTIONS
// ========================================

// Get user's cart
const getUserCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  
  const userWithCart = await user
    .findById(userId)
    .populate({
      path: 'cart.productId',
      select: 'productName price mainImage item_count weight description',
    })
    .select('cart');

  if (!userWithCart) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  // Transform cart to match frontend expectations
  const cart = userWithCart.cart.map(item => ({
    _id: item.productId._id,
    name: item.productId.productName,
    price: item.productId.price,
    pic: item.productId.mainImage,
    quantity: item.quantity,
    ct: item.productId.item_count,
    weight: item.productId.weight,
    description: item.productId.description,
  }));

  res.status(200).json({ cart });
});

// Add item to cart
const addToCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  const { productId, quantity = 1 } = req.body;

  const userDoc = await user.findById(userId);
  
  if (!userDoc) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  // Check if product already exists in cart
  const existingItemIndex = userDoc.cart.findIndex(
    item => item.productId.toString() === productId
  );

  if (existingItemIndex > -1) {
    // Update quantity if item exists
    userDoc.cart[existingItemIndex].quantity += quantity;
  } else {
    // Add new item to cart
    userDoc.cart.push({
      productId,
      quantity,
    });
  }

  await userDoc.save();

  res.status(200).json({ 
    message: "Item added to cart successfully",
    cart: userDoc.cart 
  });
});

// Remove item from cart
const removeFromCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  const itemId = req.params.itemId;

  const userDoc = await user.findById(userId);
  
  if (!userDoc) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  // Remove item from cart
  userDoc.cart = userDoc.cart.filter(
    item => item.productId.toString() !== itemId
  );

  await userDoc.save();

  res.status(200).json({ 
    message: "Item removed from cart successfully",
    cart: userDoc.cart 
  });
});

// Update cart item quantity
const updateCartQuantity = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  const itemId = req.params.itemId;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    const error = new CustomError("Invalid quantity", 400);
    return next(error);
  }

  const userDoc = await user.findById(userId);
  
  if (!userDoc) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  // Find and update the item
  const itemIndex = userDoc.cart.findIndex(
    item => item.productId.toString() === itemId
  );

  if (itemIndex === -1) {
    const error = new CustomError("Item not found in cart", 404);
    return next(error);
  }

  userDoc.cart[itemIndex].quantity = quantity;
  await userDoc.save();

  res.status(200).json({ 
    message: "Cart updated successfully",
    cart: userDoc.cart 
  });
});

// Clear entire cart
const clearCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;

  const userDoc = await user.findById(userId);
  
  if (!userDoc) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  userDoc.cart = [];
  await userDoc.save();

  res.status(200).json({ 
    message: "Cart cleared successfully",
    cart: [] 
  });
});

// Merge guest cart with user cart (on login)
const mergeCart = asyncErrorHandler(async (req, res, next) => {
  const userId = req.params.userId;
  const { items } = req.body; // Guest cart items

  const userDoc = await user.findById(userId);
  
  if (!userDoc) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  // Merge guest cart items
  items.forEach(guestItem => {
    const existingItemIndex = userDoc.cart.findIndex(
      item => item.productId.toString() === guestItem._id
    );

    if (existingItemIndex > -1) {
      // Add quantities if item exists
      userDoc.cart[existingItemIndex].quantity += guestItem.quantity || 1;
    } else {
      // Add new item
      userDoc.cart.push({
        productId: guestItem._id,
        quantity: guestItem.quantity || 1,
      });
    }
  });

  await userDoc.save();

  res.status(200).json({ 
    message: "Carts merged successfully",
    cart: userDoc.cart 
  });
});

// ========================================
// EXPORTS - ONLY ONE EXPORT BLOCK
// ========================================
export {
  getUser,
  registerUser,
  loginUser,
  getAllDetailsUser,
  logOutUser,
  verifyGmail,
  forgotPassword,
  resetPassword,
  deleteUser,
  getUserCart,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  mergeCart,
};