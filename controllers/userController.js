const User = require('../models/User');

// @desc    Get all users (for search)
// @route   GET /api/users?search=
const allUsers = async (req, res) => {
    let searchQuery = (req.query.search || "").trim();
    
    // Strip '#' prefix if present for ID search
    if (searchQuery.startsWith('#')) {
        searchQuery = searchQuery.substring(1);
    }

    try {
        // Data Repair: Assign IDs to users created before the system added them
        const usersWithoutId = await User.find({ uniqueChatID: { $exists: false } });
        if (usersWithoutId.length > 0) {
            for (const u of usersWithoutId) {
                let newId;
                let exists = true;
                while (exists) {
                    newId = Math.floor(1000 + Math.random() * 9000).toString();
                    exists = await User.findOne({ uniqueChatID: newId });
                }
                u.uniqueChatID = newId;
                await u.save();
            }
        }

        const keyword = searchQuery
            ? {
                  $or: [
                      { name: { $regex: searchQuery, $options: 'i' } },
                      { email: { $regex: searchQuery, $options: 'i' } },
                      { uniqueChatID: { $regex: searchQuery, $options: 'i' } },
                  ],
              }
            : {};

        const users = await User.find(keyword)
            .find({ _id: { $ne: req.user._id } })
            .select('-password');
        
        res.send(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
const updateProfile = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.name = req.body.name || user.name;
        user.profilePicture = req.body.profilePicture || user.profilePicture;
        
        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            profilePicture: updatedUser.profilePicture,
            uniqueChatID: updatedUser.uniqueChatID,
            token: req.token
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Send a friend request
// @route   POST /api/users/requests/send/:userId
const sendFriendRequest = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const fromUserId = req.user._id;

        if (targetUserId === fromUserId.toString()) {
            return res.status(400).json({ message: "You cannot send a request to yourself" });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Check if already friends
        if (targetUser.friends.includes(fromUserId)) {
            return res.status(400).json({ message: "Already friends" });
        }

        // Check if request already exists
        const requestExists = targetUser.friendRequests.find(r => r.from.toString() === fromUserId.toString() && r.status === 'pending');
        if (requestExists) {
            return res.status(400).json({ message: "Request already sent" });
        }

        targetUser.friendRequests.push({ from: fromUserId, status: 'pending' });
        await targetUser.save();

        res.json({ message: "Friend request sent" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get pending friend requests
// @route   GET /api/users/requests
const getFriendRequests = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('friendRequests.from', 'name profilePicture uniqueChatID email');
        const pendingRequests = user.friendRequests.filter(r => r.status === 'pending');
        res.json(pendingRequests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Respond to friend request (accept/reject)
// @route   POST /api/users/requests/respond/:requestId
const respondToFriendRequest = async (req, res) => {
    try {
        const { status } = req.body; // 'accepted' or 'rejected'
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const user = await User.findById(req.user._id);
        const requestIndex = user.friendRequests.findIndex(r => r._id.toString() === req.params.requestId);

        if (requestIndex === -1) {
            return res.status(404).json({ message: "Request not found" });
        }

        const requesterId = user.friendRequests[requestIndex].from;

        if (status === 'accepted') {
            // Add to each other's friends list
            if (!user.friends.includes(requesterId)) {
                user.friends.push(requesterId);
            }
            
            const requester = await User.findById(requesterId);
            if (requester && !requester.friends.includes(user._id)) {
                requester.friends.push(user._id);
                await requester.save();
            }
        }

        // Remove the request from the list
        user.friendRequests.splice(requestIndex, 1);
        await user.save();

        res.json({ message: `Friend request ${status}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all friends
// @route   GET /api/users/friends
const getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('friends', 'name profilePicture email status lastSeen uniqueChatID');
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user.friends);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Remove a friend
// @route   DELETE /api/users/friends/:userId
const removeFriend = async (req, res) => {
    try {
        const friendId = req.params.userId;
        const userId = req.user._id;

        const user = await User.findById(userId);
        const friend = await User.findById(friendId);

        if (!user || !friend) {
            return res.status(404).json({ message: "User not found" });
        }

        // Remove each other from friends list
        user.friends = user.friends.filter(id => id.toString() !== friendId);
        await user.save();

        friend.friends = friend.friends.filter(id => id.toString() !== userId.toString());
        await friend.save();

        res.json({ message: "Friend removed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { 
    allUsers, 
    updateProfile, 
    getFriends, 
    removeFriend, 
    sendFriendRequest, 
    getFriendRequests, 
    respondToFriendRequest 
};
