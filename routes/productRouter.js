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

import multer from "multer";
import { addCategory,gellAllCategory,deleteCategory, editCategory} from "../controller/categoryController.js";
import { addBrand,deleteBrand,editBrand,gellAllBrand } from "../controller/brandController.js";
import { protect } from "../middleware/authMiddleware.js";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const router = Router();
// category controller
router.route("/category/addCategory").post(addCategory);
router.route("/category/getAllCategory").get(gellAllCategory);
router.route("/category/delete/:id").post(deleteCategory);
router.route("/category/edit/:id").put(editCategory);


router.route("/brand/addBrand").post(addBrand);
router.route("/brand/getBrand").get(gellAllBrand);
router.route("/category/getBrandName").get(getBrandName);
router.route("/brand/delete/:id").put(deleteBrand)
router.route("/brand/editBrand/:id").put(editBrand);

// router.route("/order/addOrder/:userid/:productid").post(addOrder);


// Set up storage for multer
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads");
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
//   },
// });

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    return {
      folder:
        file.fieldname === "mainImage"
          ? "products/main"
          : "products/additional",

      public_id: uniqueId,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    };
  },
});

const upload = multer({ storage: storage });
const productUpload = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "additionalImages", maxCount: 10 },
]);
router.route("/addProduct").post(protect,productUpload, addProduct);
router.route("/editProduct/:id").put(protect,productUpload, editProduct);
router.route("/getAllDetails").get(getProductDetailsFrom);
router.route("/getOneProduct/:id").get(protect,getOneProduct);
router.route("/productDelete/:id").post(protect,deleteProduct);
router.route("/oneProductDetails/:id").get(oneProductDetails);


export default router;
