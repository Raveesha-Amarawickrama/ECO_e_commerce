import jwt from "jsonwebtoken";
import { CustomError } from "../utils/customerError.js";

// Optional authentication - allows both authenticated and guest users
export const protect = (req, res, next) => {
  try {

    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
  
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }


    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.id,
        _id: decoded.id,
        name: decoded.name
      };
      next();
    } catch (jwtError) {
      req.user = null;
      next();
    }
  } catch (error) {
    req.user = null;
    next();
  }
};

// Strict authentication - requires valid token
export const requireAuth = (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      const error = new CustomError("Authentication required", 401);
      return next(error);
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      _id: decoded.id,
      name: decoded.name
    };
    
    next();
  } catch (error) {
    const authError = new CustomError("Invalid or expired token", 401);
    return next(authError);
  }
};