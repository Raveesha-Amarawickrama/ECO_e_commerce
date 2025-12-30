import { Router } from "express";
import {
  registerUser,
  loginUser,
  getAllDetailsUser,
  logOutUser,
  getUser,
  verifyGmail,
} from "../controller/userController.js";
import { forgotPassword, resetPassword } from "../controller/userController.js";
import { protect } from "../middleware/authMiddleware.js";
const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/getAllDetails").get(protect,getAllDetailsUser);
router.route("/logout").get(logOutUser);
router.route("/getuser").get(protect,getUser);
router.route("/:id/verify/:token").get(verifyGmail)
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password/:token").post(resetPassword);


export default router;


