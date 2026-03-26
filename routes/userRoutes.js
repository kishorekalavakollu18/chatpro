const express = require('express');
const { allUsers, updateProfile, getFriends, removeFriend, sendFriendRequest, getFriendRequests, respondToFriendRequest } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/profile').put(protect, updateProfile);
router.route('/friends').get(protect, getFriends);
router.route('/friends/:userId').delete(protect, removeFriend);
router.route('/requests').get(protect, getFriendRequests);
router.route('/requests/send/:userId').post(protect, sendFriendRequest);
router.route('/requests/respond/:requestId').post(protect, respondToFriendRequest);
router.route('/').get(protect, allUsers);

module.exports = router;
