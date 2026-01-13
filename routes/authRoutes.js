// authRoutes.js - Create this new file in your routes folder
import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = Router();

// Helper function to create JWT token
const createToken = (id, name) => {
  return jwt.sign({ id, name }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

// Google OAuth - Initiate authentication
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth - Callback
router.get(
  "/google/callback",
  passport.authenticate("google", { 
    failureRedirect: "http://localhost:5173/login",
    session: false 
  }),
  (req, res) => {
    try {
      // Create JWT token
      const token = createToken(req.user._id, req.user.username);
      
      // Set cookie
      res.cookie("token", token, {
        httpOnly: true,
        path: "/",
        expires: new Date(Date.now() + 1000 * 86400),
        sameSite: "lax",
      });

      // Redirect to frontend with token in URL
      res.redirect(`http://localhost:5173/auth/google/success?token=${token}`);
    } catch (error) {
      console.error("Google auth callback error:", error);
      res.redirect("http://localhost:5173/login?error=auth_failed");
    }
  }
);

export default router;