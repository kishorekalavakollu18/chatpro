const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get all messages for a specific 1to1 chat
// @route   GET /api/messages/:userId
const getMessages = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const messages = await Message.find({
            $or: [
                { sender: req.user._id, receiver: req.params.userId },
                { sender: req.params.userId, receiver: req.user._id },
            ],
        })
            .populate('sender', 'name profilePicture email')
            .populate('receiver', 'name profilePicture email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        res.json(messages.reverse()); // Reverse to show in chronological order on client
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Edit a message
// @route   PUT /api/messages/:messageId
const editMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to edit' });
        }
        message.content = req.body.content || message.content;
        await message.save();
        res.json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId
const deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized to delete' });
        }
        await message.deleteOne();
        res.json({ message: 'Message removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/read/:chatId
const markAsRead = async (req, res) => {
    try {
        const { chatId } = req.params;
        const msgType = req.query.type; // '1to1' or 'group'

        const filter = msgType === '1to1' 
            ? { sender: chatId, receiver: req.user._id, readBy: { $ne: req.user._id } }
            : { group: chatId, readBy: { $ne: req.user._id } };

        await Message.updateMany(
            filter,
            { $addToSet: { readBy: req.user._id } }
        );

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all recent chats (1to1 and groups)
// @route   GET /api/messages/chats
const getRecentChats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find all unique 1to1 users from messages
        const privateMessages = await Message.find({
            group: { $exists: false },
            $or: [{ sender: userId }, { receiver: userId }]
        }).sort({ createdAt: -1 });

        const userIds = new Set();
        privateMessages.forEach(m => {
            if (m.sender && m.sender.toString() !== userId.toString()) userIds.add(m.sender.toString());
            if (m.receiver && m.receiver.toString() !== userId.toString()) userIds.add(m.receiver.toString());
        });

        const users = await User.find({ _id: { $in: Array.from(userIds) } }).select('name profilePicture status lastSeen uniqueChatID');

        const chats = [];

        // Process Private Chats
        for (const user of users) {
            const latestMsg = await Message.findOne({
                group: { $exists: false },
                $or: [
                    { sender: userId, receiver: user._id },
                    { sender: user._id, receiver: userId }
                ]
            }).sort({ createdAt: -1 }).populate('sender', 'name');

            const unreadCount = await Message.countDocuments({
                group: { $exists: false },
                sender: user._id,
                receiver: userId,
                readBy: { $ne: userId }
            });

            chats.push({
                _id: user._id,
                name: user.name,
                profilePicture: user.profilePicture,
                status: user.status,
                lastSeen: user.lastSeen,
                uniqueChatID: user.uniqueChatID,
                latestMessage: latestMsg,
                unreadCount,
                type: '1to1'
            });
        }


        // Sort by latest message
        chats.sort((a, b) => {
            const aTime = a.latestMessage ? new Date(a.latestMessage.createdAt) : new Date(0);
            const bTime = b.latestMessage ? new Date(b.latestMessage.createdAt) : new Date(0);
            return bTime - aTime;
        });

        res.json(chats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload media
// @route   POST /api/messages/upload
const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        res.status(200).json({
            url: req.file.path,
            type: req.file.mimetype.startsWith('image/') ? 'image' : (req.file.mimetype.startsWith('audio/') ? 'voice' : 'file'),
            name: req.file.originalname,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Search messages within a chat
// @route   GET /api/messages/search/:chatId?q=
const searchMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { q } = req.query;
        const msgType = req.query.type || '1to1';

        if (!q) return res.json([]);

        const filter = msgType === '1to1'
            ? {
                $or: [
                    { sender: req.user._id, receiver: chatId },
                    { sender: chatId, receiver: req.user._id },
                ],
                content: { $regex: q, $options: 'i' }
            }
            : {
                group: chatId,
                content: { $regex: q, $options: 'i' }
            };

        const messages = await Message.find(filter)
            .populate('sender', 'name profilePicture')
            .sort({ createdAt: -1 });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getMessages, editMessage, deleteMessage, markAsRead, getRecentChats, uploadMedia, searchMessages };
