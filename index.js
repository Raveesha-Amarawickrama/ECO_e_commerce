import express, { json } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import passportConfig from "./config/passport.js";
import jwt from "jsonwebtoken";
import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import billRouter from "./routes/billRouter.js";
import cartRoutes from './routes/cartRoutes.js';
import wishlistRoutes from './routes/wishlisRoutes.js'; 
import orderRoutes from './routes/orderRoutes.js';
import contactRoutes from './routes/contactRoutes.js'; 

import authRouter from "./routes/authRoutes.js";
import orderRouter from "./routes/orderRoutes.js";
import countRouter from "./routes/countDetailsRouter.js";
import feedbackRouter from "./routes/feedbackRouter.js";
import { CustomError } from "./utils/customerError.js";
import globalErrorHandler from "./controller/errorController.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const app = express();
app.use(cookieParser());

const port = parseInt(process.env.PORT, 10) || 5000;

// Middleware
app.use(json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

const allowedOrigins = [
  "http://localhost:5173", 
  process.env.BASE_URL, 
  process.env.BASE_URL_TWO, 
  process.env.DASH_URL,
  process.env.ADMIN_DASH_URL,
  'http://localhost:3001'
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", 'x-session-id']
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passportConfig(passport);

// File paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =====================
// ROUTES
// =====================

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running" });
});

// User & Auth Routes
app.use("/user", userRouter);
app.use("/auth", authRouter);

// Product Routes
app.use("/products", productRouter);

// Shopping Routes
app.use("/cart", cartRoutes);
app.use("/wishlist", wishlistRoutes); 

// Order & Billing Routes
app.use("/bill", billRouter);
app.use("/order", orderRouter);
app.use("/checkout", orderRoutes);

// Other Routes
app.use("/feedback", feedbackRouter);
app.use("/dashboard", countRouter);
app.use("/contact", contactRoutes);

// =====================
// ERROR HANDLING
// =====================

app.all("*", (req, res, next) => {
  const err = new CustomError(`Can't find ${req.originalUrl} on the server`, 404);
  next(err);
});

app.use(globalErrorHandler);

// =====================
// DATABASE CONNECTION
// =====================

mongoose
  .connect(process.env.CONNECT_STR)
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
  });

// =====================
// START SERVER
// =====================

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`Allowed Origins: ${allowedOrigins.join(", ")}`);
  console.log(`📦 Cart routes: http://localhost:${port}/cart`);
  console.log(`❤️  Wishlist routes: http://localhost:${port}/wishlist`); // ✅ ADD THIS
  console.log(`📧 Contact routes: http://localhost:${port}/contact`);
});