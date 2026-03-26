const express = require('express');
const { getMessages, getGroupMessages, editMessage, deleteMessage, markAsRead, getRecentChats, uploadMedia, searchMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const router = express.Router();

router.route('/chats').get(protect, getRecentChats);
router.route('/:userId').get(protect, getMessages);
router.route('/upload').post(protect, upload.single('file'), uploadMedia);
router.route('/search/:chatId').get(protect, searchMessages);
router.route('/m/:messageId').put(protect, editMessage).delete(protect, deleteMessage);
router.put('/read/:chatId', protect, markAsRead);

module.exports = router;
