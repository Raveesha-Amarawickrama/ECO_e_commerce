// model/categoryModel.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      index: true
    },
    
    description: {
      type: String,
      trim: true
    },
    
    image: {
      type: String
    },
    
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    },
    
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for better query performance
categorySchema.index({ categoryName: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1 });

// Virtual for product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'categoryId',
  count: true
});

// Pre-save hook to generate slug
categorySchema.pre('save', async function(next) {
  if (this.isModified('categoryName') || this.isNew) {
    this.slug = this.categoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Static method to find active categories
categorySchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

const Category = mongoose.model("Category", categorySchema);

export default Category;