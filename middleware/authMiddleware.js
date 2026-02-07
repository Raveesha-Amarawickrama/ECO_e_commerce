// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { CustomError } from "../utils/customerError.js";

/**
 * PROTECT middleware - Optional Authentication
 * Allows requests to proceed whether authenticated or not
 * Sets req.user if valid token exists, otherwise sets req.user = null
 * USE FOR: Cart operations (guest users need cart access)
 */
export const protect = (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header (Priority 1)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check cookies (Priority 2)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check query parameters (Priority 3 - for OAuth callbacks)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    // CRITICAL: If no token, allow request to proceed with req.user = null
    if (!token) {
      console.log('[PROTECT] No token found - allowing guest access');
      req.user = null;
      return next();
    }

    try {
      // Verify token and set user
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.id,
        _id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role
      };
      console.log('[PROTECT] Valid token - user authenticated:', decoded.id);
      next();
    } catch (jwtError) {
      // Token exists but is invalid/expired - allow as guest
      console.error('[PROTECT] JWT verification failed:', jwtError.message);
      req.user = null;
      next();
    }
  } catch (error) {
    console.error('[PROTECT] Middleware error:', error);
    req.user = null;
    next();
  }
};

/**
 * REQUIRE_AUTH middleware - Strict Authentication Required
 * Blocks requests without valid authentication token
 * Returns 401 error if no valid token
 * USE FOR: Wishlist, checkout, profile operations (must be logged in)
 */
export const requireAuth = (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header (Priority 1)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check cookies (Priority 2)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check query parameters (Priority 3)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    // CRITICAL: If no token, return 401 error
    if (!token) {
      console.log('[REQUIRE_AUTH] No token - blocking request');
      const error = new CustomError("Authentication required", 401);
      return next(error);
    }

    try {
      // Verify token and set user
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.id,
        _id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role
      };
      console.log('[REQUIRE_AUTH] Valid token - user authenticated:', decoded.id);
      next();
    } catch (jwtError) {
      // Token exists but is invalid/expired - return 401 error
      console.error('[REQUIRE_AUTH] Invalid/expired token:', jwtError.message);
      const authError = new CustomError("Invalid or expired token", 401);
      return next(authError);
    }
  } catch (error) {
    console.error('[REQUIRE_AUTH] Middleware error:', error.message);
    const authError = new CustomError("Authentication failed", 401);
    return next(authError);
  }
};

/**
 * ADMIN_ONLY middleware - Requires Admin Role
 * Must be used AFTER requireAuth middleware
 * Checks if authenticated user has admin role
 * USE FOR: Admin panel routes
 */
export const adminOnly = (req, res, next) => {
  if (!req.user) {
    const error = new CustomError("Authentication required", 401);
    return next(error);
  }

  if (req.user.role !== 'admin') {
    const error = new CustomError("Admin access required", 403);
    return next(error);
  }

  console.log('[ADMIN_ONLY] Admin access granted:', req.user.id);
  next();
};

// Export all middleware functions
export default {
  protect,
  requireAuth,
  adminOnly
};