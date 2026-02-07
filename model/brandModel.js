import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      unique: true,
      index: true
    },
    
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, "Category is required"],
      index: true
    },
    
    description: {
      type: String,
      trim: true
    },
    
    logo: {
      type: String
    },
    
    website: {
      type: String,
      trim: true
    },
    
    country: {
      type: String,
      trim: true
    },
    
    isActive: {
      type: Boolean,
      default: true,
      index: true
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
brandSchema.index({ brandName: 1 });
brandSchema.index({ slug: 1 });
brandSchema.index({ isActive: 1, category: 1 });

// Virtual for product count
brandSchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'brandId',
  count: true
});

// Pre-save hook to generate slug
brandSchema.pre('save', async function(next) {
  if (this.isModified('brandName') || this.isNew) {
    this.slug = this.brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Static method to find active brands
brandSchema.statics.findActive = function() {
  return this.find({ isActive: true }).populate('category', 'categoryName');
};

const Brand = mongoose.model("Brand", brandSchema);

export default Brand;