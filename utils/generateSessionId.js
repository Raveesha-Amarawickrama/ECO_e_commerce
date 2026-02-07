// utils/generateSessionId.js
export const getOrCreateSessionId = (req, res) => {
  // Check for existing session ID from:
  // 1. Request header
  // 2. Cookie
  // 3. Query parameter
  let sessionId = 
    req.headers['x-session-id'] || 
    req.cookies?.sessionId || 
    req.query?.sessionId;

  // If no session ID exists, create a new one
  if (!sessionId) {
    sessionId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set cookie for future requests (7 days expiry)
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  return sessionId;
};

// Cleanup old guest carts (optional - run as cron job)
export const cleanupGuestCarts = async (Cart) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  try {
    const result = await Cart.deleteMany({
      sessionId: { $exists: true, $ne: null },
      userId: { $exists: false },
      updatedAt: { $lt: sevenDaysAgo }
    });
    
    console.log(`Cleaned up ${result.deletedCount} old guest carts`);
    return result;
  } catch (error) {
    console.error('Error cleaning up guest carts:', error);
    throw error;
  }
};