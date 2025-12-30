import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = Router();

// Google OAuth routes
router.get("/google", passport.authenticate("google", { 
  scope: ["profile", "email"] 
}));

router.get("/google/callback", 
  passport.authenticate("google", { 
    failureRedirect: "/login",
    session: false 
  }),
  (req, res) => {
    // Generate JWT token
    const token = jwt.sign(
      { id: req.user._id, name: req.user.username }, 
      process.env.JWT_SECRET, 
      { expiresIn: "1d" }
    );
    
    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      path: "/",
      expires: new Date(Date.now() + 1000 * 86400),
      sameSite: "lax",
    });
    
    // Redirect to frontend with token
    res.redirect(`http://localhost:5173/?token=${token}`);
  }
);

export default router;