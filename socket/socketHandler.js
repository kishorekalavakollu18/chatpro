const Message = require('../models/Message');
const User = require('../models/User');

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log('Connected to socket.io');

        socket.on('setup', async (userData) => {
            socket.join(userData._id);
            socket.userId = userData._id; 
            
            try {
                // Update user status to online in DB
                await User.findByIdAndUpdate(userData._id, { status: 'online' });
                
                // Get all online user IDs from DB
                const onlineUsers = await User.find({ status: 'online' }, '_id');
                const onlineUserIds = onlineUsers.map(u => u._id.toString());
                
                socket.emit('connected', onlineUserIds);
                socket.broadcast.emit('user online', userData._id);
            } catch (error) {
                console.error('Error updating status to online:', error);
            }
        });

        socket.on('join chat', (room) => {
            socket.join(room);
            console.log('User Joined Room: ' + room);
        });

        socket.on('typing', (room) => socket.in(room).emit('typing', { room, senderId: socket.userId }));
        socket.on('stop typing', (room) => socket.in(room).emit('stop typing', { room, senderId: socket.userId }));

        socket.on('new message', async (newMessageReceived) => {
            const { sender, content, mediaFile, receiver } = newMessageReceived;

            if (!sender || (!content && !mediaFile)) return console.log('Invalid message data');

            try {
                // Enforce friendship before allowing message
                const senderUser = await User.findById(sender);
                if (senderUser && !senderUser.friends.map(id => id.toString()).includes(receiver)) {
                    return socket.emit('message error', { message: 'You must be friends to send messages.' });
                }

                // Save message to DB
                const message = await Message.create({
                    sender,
                    content,
                    mediaFile,
                    receiver,
                    chatType: '1to1',
                });

                const fullMessage = await Message.findById(message._id)
                    .populate('sender', 'name profilePicture')
                    .populate('receiver', 'name profilePicture');

                // Emit to the appropriate room (receiver's ID)
                socket.in(receiver).emit('message received', fullMessage);
            } catch (error) {
                console.error('Error saving message:', error);
            }
        });

        // Real-time friend request notification
        socket.on('friend request sent', ({ toUserId, fromUser }) => {
            socket.in(toUserId).emit('new friend request', { from: fromUser });
        });

        socket.on('message edited', (updatedMessage) => {
            const { receiver } = updatedMessage;
            socket.in(receiver).emit('message edited', updatedMessage);
        });

        socket.on('message deleted', (data) => {
            const { messageId, chatId } = data;
            socket.in(chatId).emit('message deleted', { messageId, chatId });
        });

        socket.on('disconnect', async () => {
            console.log('USER DISCONNECTED:', socket.userId);
            if (socket.userId) {
                try {
                    // Update user status to offline and set lastSeen
                    await User.findByIdAndUpdate(socket.userId, { 
                        status: 'offline',
                        lastSeen: new Date()
                    });
                    socket.broadcast.emit('user offline', socket.userId);
                } catch (error) {
                    console.error('Error updating status to offline:', error);
                }
            }
        });
    });
};

module.exports = socketHandler;
