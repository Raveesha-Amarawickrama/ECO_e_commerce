import Brand from "../model/brandModel.js";
import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import Category from "../model/categoryModel.js";

const addBrand = asyncErrorHandler(async (req, res, next) => {
  const { brandName, category } = req.body;
  
  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    const error = new CustomError("Category not found", 404);
    return next(error);
  }
  
  const brandExit = await Brand.findOne({ brandName });
  if (brandExit && brandExit.isActive === true) {
    const error = new CustomError("Brand already exists", 409);
    return next(error);
  }
  
  if (brandExit && brandExit.isActive === false) {
    brandExit.isActive = true;
    brandExit.category = category;
    await brandExit.save();
    return res.status(200).json({ message: "ok", brand: brandExit });
  }
  
  const brand = await Brand.create({ brandName, category });
  
  return res.status(201).json({ message: "ok", brand });
});

const gellAllBrand = asyncErrorHandler(async (req, res, next) => {
  const allbrand = await Brand.find({})
    .populate("category", "categoryName")
    .exec();
  res.status(200).json(allbrand);
});

const deleteBrand = asyncErrorHandler(async (req, res, next) => {
  const brandStatus = await Brand.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  ).populate("category", "categoryName");
  
  if (!brandStatus) {
    const error = new CustomError("Brand not found", 404);
    return next(error);
  }
  
  res.json({ message: "ok", brandStatus });
});

const editBrand = asyncErrorHandler(async (req, res, next) => {
  const brandId = req.params.id;
  const { brandName, category } = req.body;

  if (category) {
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      const error = new CustomError("Category not found", 404);
      return next(error);
    }
  }

  const updatedBrand = await Brand.findByIdAndUpdate(
    brandId,
    { brandName, category },
    { new: true, runValidators: true }
  ).populate("category", "categoryName");
  
  if (!updatedBrand) {
    const error = new CustomError("Brand not found", 404);
    return next(error);
  }
  
  res.json({ message: "ok", brand: updatedBrand });
});

export { addBrand, gellAllBrand, deleteBrand, editBrand };