const mongoose = require('mongoose');

const mensagemSchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  nomeAutor: { type: String, required: true, trim: true, maxlength: 80 },
  texto: { type: String, required: true, trim: true, maxlength: 1000 }
}, { timestamps: true });

mensagemSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Mensagem', mensagemSchema);
