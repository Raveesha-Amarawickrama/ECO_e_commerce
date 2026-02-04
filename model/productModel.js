import mongoose from "mongoose";

const products = new mongoose.Schema({
  productName: {
    type: String,
  },
  price: {
    type: Number,
  },
  item_count: {
    type: Number,
  },
  description: {
    type: String,
  },
  weight: {
    type: Number,
  },
  color: {
    type: String,
  },
  size: {
    type: String,
    default: "normal",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "category",
    required: true,
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "brand",
    required: true,
  },
  mainImage: {
    type: String,
  },
  additionalImages: [
    {
      type: String,
    },
  ],
  sellType: {
    type: String,
    default: "ex",
  },
  categoryType: {
    type: String,
    enum: ["cosmetics", "electronics", "other"],
    default: "other",
  },
  specifications: {
    // Common field
    usage: {
      type: String,
      default: "",
    },
    
    // Cosmetics specifications
    manufactureCountry: {
      type: String,
      default: "",
    },
    netWeightVolume: {
      type: String,
      default: "",
    },
    suitableFor: {
      type: String,
      default: "",
    },
    hairSkinType: {
      type: String,
      default: "",
    },
    keyIngredients: {
      type: String,
      default: "",
    },
    packaging: {
      type: String,
      default: "",
    },
    shelfLife: {
      type: String,
      default: "",
    },
    
    // Electronics specifications
    model: {
      type: String,
      default: "",
    },
    powerSupply: {
      type: String,
      default: "",
    },
    material: {
      type: String,
      default: "",
    },
    compatibility: {
      type: String,
      default: "",
    },
    warranty: {
      type: String,
      default: "",
    },
  },
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

const Product = mongoose.model("product", products);
export default Product;