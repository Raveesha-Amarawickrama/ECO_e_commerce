import express from "express";
import { 
  addBrand, 
  gellAllBrand, 
  deleteBrand, 
  editBrand 
} from "../controller/brandController.js";

const router = express.Router();

// Public route - get all brands
router.get("/", gellAllBrand);

// Admin routes - add your authentication middleware if needed
router.post("/", addBrand);
router.patch("/:id", editBrand);
router.delete("/:id", deleteBrand);

export default router;