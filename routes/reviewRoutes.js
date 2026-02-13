// routes/reviewRoutes.js
import express from 'express';
import Review from '../model/Review.js';

const router = express.Router();

// GET all reviews (for admin) - MUST BE FIRST before specific routes
router.get('/', async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Fetch reviews with product details
    const reviews = await Review.find(query)
      .populate('productId', 'productName mainImage')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error('Error fetching all reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

// GET reviews for a specific product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { status = 'approved', limit = 50 } = req.query;

    // Build query
    const query = { productId };
    if (status) {
      query.status = status;
    }

    // Fetch reviews
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Calculate statistics
    const allReviews = await Review.find({ productId, status: 'approved' });
    
    const stats = {
      total: allReviews.length,
      average: allReviews.length > 0 
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length 
        : 0,
      distribution: {
        5: (allReviews.filter(r => r.rating === 5).length / allReviews.length) * 100 || 0,
        4: (allReviews.filter(r => r.rating === 4).length / allReviews.length) * 100 || 0,
        3: (allReviews.filter(r => r.rating === 3).length / allReviews.length) * 100 || 0,
        2: (allReviews.filter(r => r.rating === 2).length / allReviews.length) * 100 || 0,
        1: (allReviews.filter(r => r.rating === 1).length / allReviews.length) * 100 || 0,
      }
    };

    res.json({
      success: true,
      reviews,
      stats
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
});

// POST - Create a new review
router.post('/', async (req, res) => {
  try {
    const { productId, rating, name, email, phone, message } = req.body;

    // Validation
    if (!productId || !rating || !name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Create review
    const review = new Review({
      productId,
      rating,
      name,
      email,
      phone,
      message,
      status: 'pending', // Reviews need approval
      createdAt: new Date()
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully! It will appear after approval.',
      review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review'
    });
  }
});

// PUT - Update a review
router.put('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const updateData = req.body;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
});

// DELETE - Delete a review
router.delete('/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndDelete(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
});

export default router;