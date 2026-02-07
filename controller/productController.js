import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import { CustomError } from "../utils/customerError.js";
import product from "../model/productModel.js";
import Brand from "../model/brandModel.js";
import category from "../model/categoryModel.js";
import { cloudinary } from "../config/cloudinary.js";

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

  // Get Cloudinary URLs from uploaded files
  const mainImage = req.files["mainImage"]
    ? req.files["mainImage"][0].path  // This is the Cloudinary URL
    : null;
  
  const additionalImages = req.files["additionalImages"]
    ? req.files["additionalImages"].map((file) => file.path)  // Array of Cloudinary URLs
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
      select: "brandName description logo"
    })
    .populate({
      path: "categoryId",
      select: "categoryName description"
    })
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
      select: "brandName description logo website country"
    })
    .populate({
      path: "categoryId",
      select: "categoryName description"
    })
    .exec();
  res.status(200).json(details);
});

const deleteProduct = asyncErrorHandler(async (req, res, next) => {
  // Get product before deletion to delete images from Cloudinary
  const productToDelete = await product.findById(req.params.id);
  
  if (productToDelete) {
    // Delete main image from Cloudinary
    if (productToDelete.mainImage) {
      const publicId = extractPublicId(productToDelete.mainImage);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`Deleted main image: ${publicId}`);
        } catch (error) {
          console.error("Error deleting main image from Cloudinary:", error);
        }
      }
    }
    
    // Delete additional images from Cloudinary
    if (productToDelete.additionalImages?.length > 0) {
      for (const imageUrl of productToDelete.additionalImages) {
        const publicId = extractPublicId(imageUrl);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
            console.log(`Deleted additional image: ${publicId}`);
          } catch (error) {
            console.error("Error deleting additional image from Cloudinary:", error);
          }
        }
      }
    }
  }

  // Soft delete: set isActive to false
  const productStatus = await product.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
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
    const existingProduct = await product.findById(productId);
    
    if (req.files["mainImage"]) {
      // Delete old main image from Cloudinary
      if (existingProduct?.mainImage) {
        const publicId = extractPublicId(existingProduct.mainImage);
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
            console.log(`Deleted old main image: ${publicId}`);
          } catch (error) {
            console.error("Error deleting old main image:", error);
          }
        }
      }
      updateData.mainImage = req.files["mainImage"][0].path; // New Cloudinary URL
    }
    
    if (req.files["additionalImages"]) {
      // Delete old additional images from Cloudinary
      if (existingProduct?.additionalImages?.length > 0) {
        for (const imageUrl of existingProduct.additionalImages) {
          const publicId = extractPublicId(imageUrl);
          if (publicId) {
            try {
              await cloudinary.uploader.destroy(publicId);
              console.log(`Deleted old additional image: ${publicId}`);
            } catch (error) {
              console.error("Error deleting old additional image:", error);
            }
          }
        }
      }
      updateData.additionalImages = req.files["additionalImages"].map(
        (file) => file.path  // New Cloudinary URLs
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

// Helper function to extract public_id from Cloudinary URL
// URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{folder}/{filename}.{ext}
const extractPublicId = (url) => {
  if (!url) return null;
  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    
    if (uploadIndex !== -1 && parts[uploadIndex + 1]) {
      // Skip version number if present (e.g., v1234567890)
      let startIndex = uploadIndex + 1;
      if (parts[startIndex] && parts[startIndex].startsWith('v')) {
        startIndex++;
      }
      
      // Get everything after 'upload/v{version}/' and remove file extension
      const pathAfterUpload = parts.slice(startIndex).join('/');
      const publicId = pathAfterUpload.substring(0, pathAfterUpload.lastIndexOf('.'));
      return publicId;
    }
  } catch (error) {
    console.error('Error extracting public_id:', error);
  }
  return null;
};

export {
  addProduct,
  getBrandName,
  getProductDetailsFrom,
  getOneProduct,
  deleteProduct,
  oneProductDetails,
  editProduct,
};