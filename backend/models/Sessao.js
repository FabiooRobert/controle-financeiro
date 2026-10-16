const mongoose = require('mongoose');

const sessaoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  ativaAte: { type: Date, required: true },
  revogadaEm: { type: Date, default: null },
  expiraEm: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Sessao', sessaoSchema);
