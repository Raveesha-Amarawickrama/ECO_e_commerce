import express from 'express';
import { 
  sendContactEmail, 
  getAllMessages, 
  getMessage, 
  updateMessageStatus, 
  deleteMessage,
  getUnreadCount 
} from '../controller/contactController.js';

const router = express.Router();

// Send contact message
router.post('/send', sendContactEmail);

// Get all messages
router.get('/messages', getAllMessages);

// Get unread count
router.get('/messages/unread-count', getUnreadCount);

// Get single message
router.get('/messages/:id', getMessage);

// Update message status
router.put('/messages/:id/status', updateMessageStatus);

// Delete message
router.delete('/messages/:id', deleteMessage);

export default router;