const mongoose = require('mongoose');

const despesaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  descricao: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  valor: { type: Number, required: true, min: 0.01 },
  categoria: { type: String, trim: true, maxlength: 40, default: 'Outros' },
  data: { type: Date, default: Date.now },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Despesa', despesaSchema);