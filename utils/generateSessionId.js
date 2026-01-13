// utils/generateSessionId.js

export const getOrCreateSessionId = (req) => {
  // Try to get sessionId from header first (sent from frontend)
  let sessionId = req.headers['x-session-id'];
  
  if (sessionId && sessionId !== 'null' && sessionId !== 'undefined') {
    return sessionId;
  }
  
  // Generate new sessionId if none exists
  sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return sessionId;
};