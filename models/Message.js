const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: "" },
    mediaFile: {
        url: { type: String, default: "" },
        type: { type: String, default: "" }, // 'image', 'file', 'voice'
        name: { type: String, default: "" }
    },
    chatType: { type: String, enum: ['1to1', 'group'], required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for 1to1
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // for group
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
