import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import product from "../model/productModel.js";
import Brand from "../model/brandModel.js";
import category from "../model/categoryModel.js";

const addProduct = asyncErrorHandler(async (req, res, next) => {
  const {
    productName,
    price,
    item_count,
    description,
    weight,
    color,
    size,
    categoryId,
    brandId,
    specifications,
    categoryType,
  } = req.body;

  const mainImage = req.files["mainImage"]
    ? req.files["mainImage"][0].path
    : null;
  const additionalImages = req.files["additionalImages"]
    ? req.files["additionalImages"].map((file) => file.path)
    : [];

  // Parse specifications if it's a JSON string
  let parsedSpecs = {};
  if (specifications) {
    try {
      parsedSpecs = typeof specifications === "string" 
        ? JSON.parse(specifications) 
        : specifications;
    } catch (error) {
      console.error("Error parsing specifications:", error);
    }
  }

  const productAdd = await product.create({
    productName,
    price,
    item_count,
    color,
    size,
    description,
    weight,
    categoryId,
    brandId,
    mainImage,
    additionalImages,
    categoryType: categoryType || "other",
    specifications: parsedSpecs,
  });

  return res.status(201).json({ message: "ok", productAdd });
});

// product form to brand name
const getBrandName = asyncErrorHandler(async (req, res, next) => {
  const categoryId = req.query.category;

  const brands = await Brand.find({ category: categoryId }).populate(
    "category"
  );
  return res.status(200).json(brands);
});

const getProductDetailsFrom = asyncErrorHandler(async (req, res, next) => {
  const allDetailsDetails = await product
    .find({})
    .populate({
      path: "brandId",
      select: "brandName category",
      populate: { path: "category", select: "categoryName" },
    })
    .populate("categoryId")
    .exec();
  res.status(200).json(allDetailsDetails);
});

const getOneProduct = asyncErrorHandler(async (req, res, next) => {
  const productId = req.params.id;
  const productOne = await product.findById(productId);
  if (!productOne) {
    const error = new CustomError("Product not found", 404);
    return next(error);
  }
  return res.status(200).json(productOne);
});

const oneProductDetails = asyncErrorHandler(async (req, res, next) => {
  const productId = req.params.id;
  const details = await product
    .findById(productId)
    .populate({
      path: "brandId",
      select: "brandName category",
      populate: { path: "category", select: "categoryName" },
    })
    .exec();
  res.status(200).json(details);
});

const deleteProduct = asyncErrorHandler(async (req, res, next) => {
  const productStatus = await product.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
    },
    { new: true }
  );
  res.json({ message: "ok", productStatus });
});

const editProduct = asyncErrorHandler(async (req, res, next) => {
  const productId = req.params.id;
  let updateData = {};

  // Only add fields to updateData that are provided in the request
  const fieldsToUpdate = [
    "productName",
    "price",
    "item_count",
    "color",
    "size",
    "categoryId",
    "brandId",
    "weight",
    "description",
    "categoryType",
  ];
  
  fieldsToUpdate.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  // Handle specifications
  if (req.body.specifications) {
    try {
      updateData.specifications = typeof req.body.specifications === "string"
        ? JSON.parse(req.body.specifications)
        : req.body.specifications;
    } catch (error) {
      console.error("Error parsing specifications:", error);
    }
  }

  // Handle images
  if (req.files) {
    if (req.files["mainImage"]) {
      updateData.mainImage = req.files["mainImage"][0].path;
    }
    if (req.files["additionalImages"]) {
      updateData.additionalImages = req.files["additionalImages"].map(
        (file) => file.path
      );
    }
  }

  const updatedProduct = await product.findOneAndUpdate(
    { _id: productId },
    updateData,
    { new: true }
  );
  
  res.json({ message: "ok", updatedProduct });
});

export {
  addProduct,
  getBrandName,
  getProductDetailsFrom,
  getOneProduct,
  deleteProduct,
  oneProductDetails,
  editProduct,
};