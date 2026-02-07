import { Router } from "express";
import {
  addProduct,
  deleteProduct,
  editProduct,
  getBrandName,
  getOneProduct,
  getProductDetailsFrom,
  oneProductDetails,
} from "../controller/productController.js";

import { upload } from "../config/cloudinary.js"; // Import upload from cloudinary
import { addCategory, gellAllCategory, deleteCategory, editCategory } from "../controller/categoryController.js";
import { addBrand, deleteBrand, editBrand, gellAllBrand } from "../controller/brandController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// Category routes
router.route("/category/addCategory").post(addCategory);
router.route("/category/getAllCategory").get(gellAllCategory);
router.route("/category/delete/:id").post(deleteCategory);
router.route("/category/edit/:id").put(editCategory);

// Brand routes
router.route("/brand/addBrand").post(addBrand);
router.route("/brand/getBrand").get(gellAllBrand);
router.route("/category/getBrandName").get(getBrandName);
router.route("/brand/delete/:id").put(deleteBrand);
router.route("/brand/editBrand/:id").put(editBrand);

// Product routes with Cloudinary upload
router.post(
  "/addProduct",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "additionalImages", maxCount: 3 },
  ]),
  addProduct
);

router.put(
  "/editProduct/:id",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "additionalImages", maxCount: 3 }
  ]),
  editProduct
);

// Other product routes
router.route("/getAllDetails").get(getProductDetailsFrom);
router.route("/getOneProduct/:id").get(protect, getOneProduct);
router.route("/productDelete/:id").post(protect, deleteProduct);
router.route("/oneProductDetails/:id").get(oneProductDetails);

export default router;