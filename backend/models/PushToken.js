const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, trim: true, maxlength: 255 },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true }
}, { timestamps: true });

module.exports = mongoose.model('PushToken', pushTokenSchema);
