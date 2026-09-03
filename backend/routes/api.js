const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Despesa = require('../models/Despesa');

const categorias = ['Alimentação', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Outros'];

router.post('/financas/despesa', async (req, res) => {
  try {
    const { descricao, valor, categoria } = req.body;
    if (!descricao || valor === undefined || valor === null) {
      return res.status(400).json({ success: false, message: 'Descrição e valor são obrigatórios' });
    }

    const descricaoLimpa = String(descricao).trim();
    if (descricaoLimpa.length < 3 || descricaoLimpa.length > 100) {
      return res.status(400).json({ success: false, message: 'Descrição deve ter entre 3 e 100 caracteres' });
    }

    const valorNumerico = Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({ success: false, message: 'Valor deve ser um número positivo' });
    }

    const novaDespesa = await Despesa.create({
      descricao: descricaoLimpa,
      valor: valorNumerico,
      categoria: categorias.includes(categoria) ? categoria : 'Outros'
    });

    res.status(201).json({
      success: true,
      message: `💰 Despesa cadastrada: R$ ${valorNumerico.toFixed(2).replace('.', ',')}`,
      data: novaDespesa
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro interno ao cadastrar despesa' });
  }
});

router.get('/financas/despesas', async (req, res) => {
  try {
    const despesas = await Despesa.find().sort({ data: -1, criadoEm: -1 });
    const total = despesas.reduce((sum, d) => sum + Number(d.valor), 0);
    res.json({ success: true, total, quantidade: despesas.length, data: despesas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao listar despesas' });
  }
});

router.delete('/financas/despesa/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID da despesa inválido' });
    }

    const despesa = await Despesa.findByIdAndDelete(req.params.id);
    if (!despesa) {
      return res.status(404).json({ success: false, message: 'Despesa não encontrada' });
    }

    res.json({ success: true, message: `Despesa "${despesa.descricao}" removida com sucesso` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao deletar despesa' });
  }
});

module.exports = router;