const mongoose = require('mongoose');

const despesaSchema = new mongoose.Schema({
  descricao: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  valor: { type: Number, required: true, min: 0.01 },
  categoria: {
    type: String,
    enum: ['Alimentação', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Outros'],
    default: 'Outros'
  },
  data: { type: Date, default: Date.now },
  criadoEm: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Despesa', despesaSchema);