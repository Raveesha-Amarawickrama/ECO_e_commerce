// Generate unique session ID for guest users
export const generateSessionId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${randomStr}`;
};

// Get or create session ID from request
export const getOrCreateSessionId = (req) => {
  // Check if session ID exists in cookies or headers
  let sessionId = req.cookies?.sessionId || req.headers?.["x-session-id"];

  // If no session ID, create new one
  if (!sessionId) {
    sessionId = generateSessionId();
  }

  return sessionId;
};