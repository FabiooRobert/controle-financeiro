const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Despesa = require('../models/Despesa');
const Usuario = require('../models/Usuario');
const Sessao = require('../models/Sessao');
const Mensagem = require('../models/Mensagem');
const PushToken = require('../models/PushToken');

const categorias = ['Alimentação', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Outros'];

function criarToken(usuario, sessaoId) {
  return jwt.sign({
    id: usuario._id,
    nome: usuario.nome,
    email: usuario.email,
    sid: sessaoId
  }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function criarSessao(usuario) {
  const agora = Date.now();
  const sessao = await Sessao.create({
    usuario: usuario._id,
    ativaAte: new Date(agora + 2 * 60 * 1000),
    expiraEm: new Date(agora + 7 * 24 * 60 * 60 * 1000)
  });

  return {
    token: criarToken(usuario, sessao._id),
    usuario: { id: String(usuario._id), nome: usuario.nome, email: usuario.email }
  };
}

function exigirSegredoJwt(res) {
  const segredo = process.env.JWT_SECRET;
  if (typeof segredo === 'string' && segredo.trim().length >= 32) return true;

  console.error('JWT_SECRET ausente ou muito curto; autenticação indisponível');
  res.status(503).json({
    success: false,
    message: 'Autenticação indisponível: configure JWT_SECRET com pelo menos 32 caracteres nas variáveis do Render.'
  });
  return false;
}

function autenticar(req, res, next) {
  if (!exigirSegredoJwt(res)) return;

  const autorizacao = req.headers.authorization || '';
  const token = autorizacao.startsWith('Bearer ') ? autorizacao.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Faça login para continuar' });

  let usuario;
  try {
    usuario = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada' });
  }

  if (!usuario.sid) {
    return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada' });
  }

  Sessao.findOne({
    _id: usuario.sid,
    usuario: usuario.id,
    revogadaEm: null,
    ativaAte: { $gt: new Date() },
    expiraEm: { $gt: new Date() }
  }).then((sessao) => {
    if (!sessao) {
      res.status(401).json({ success: false, message: 'Sessão encerrada ou expirada' });
      return;
    }
    req.usuario = usuario;
    req.sessaoId = sessao._id;
    next();
  }).catch(next);
}

router.post('/auth/cadastro', async (req, res) => {
  try {
    if (!exigirSegredoJwt(res)) return;

    const nome = String(req.body.nome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    if (nome.length < 2 || nome.length > 80 || !/^\S+@\S+\.\S+$/.test(email) || senha.length < 6) {
      return res.status(400).json({ success: false, message: 'Informe nome, e-mail válido e senha com pelo menos 6 caracteres' });
    }

    const existente = await Usuario.findOne({ email });
    if (existente) return res.status(409).json({ success: false, message: 'Este e-mail já está cadastrado' });

    const usuario = await Usuario.create({ nome, email, senha: await bcrypt.hash(senha, 12) });
    res.status(201).json({ success: true, data: await criarSessao(usuario) });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Este e-mail já está cadastrado' });
    }
    res.status(500).json({ success: false, message: 'Erro ao criar cadastro' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    if (!exigirSegredoJwt(res)) return;

    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    const usuario = await Usuario.findOne({ email });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({ success: false, message: 'E-mail ou senha incorretos' });
    }
    res.json({ success: true, data: await criarSessao(usuario) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao fazer login' });
  }
});

router.post('/auth/session/touch', autenticar, async (req, res) => {
  try {
    await Sessao.updateOne(
      { _id: req.sessaoId, revogadaEm: null },
      { $set: { ativaAte: new Date(Date.now() + 2 * 60 * 1000) } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Não foi possível validar a sessão' });
  }
});

router.post('/auth/logout', autenticar, async (req, res) => {
  try {
    await Sessao.updateOne(
      { _id: req.sessaoId, revogadaEm: null },
      { $set: { revogadaEm: new Date(), ativaAte: new Date(0) } }
    );
    res.json({ success: true, message: 'Sessão encerrada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Não foi possível encerrar a sessão no servidor' });
  }
});

router.get('/chat/messages', autenticar, async (req, res) => {
  try {
    const mensagens = await Mensagem.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({
      success: true,
      data: mensagens.reverse().map((mensagem) => ({
        id: String(mensagem._id),
        authorId: String(mensagem.autor),
        authorName: mensagem.nomeAutor,
        body: mensagem.texto,
        createdAt: mensagem.createdAt
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Não foi possível carregar o chat' });
  }
});

router.post('/notificacoes/token', autenticar, async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9+/_=-]+\]$/.test(token)) {
      return res.status(400).json({ success: false, message: 'Token de notificação inválido' });
    }

    await PushToken.updateOne(
      { token },
      { $set: { usuario: req.usuario.id } },
      { upsert: true, runValidators: true }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Não foi possível registrar a notificação' });
  }
});

router.delete('/notificacoes/token', autenticar, async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!token) return res.status(400).json({ success: false, message: 'Token obrigatório' });

    await PushToken.deleteOne({ token, usuario: req.usuario.id });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Não foi possível remover a notificação' });
  }
});

router.post('/financas/despesa', autenticar, async (req, res) => {
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

    const categoriaFinal = categoria ? String(categoria).trim() : 'Outros';
    if (!categoriaFinal || categoriaFinal.length > 40) {
      return res.status(400).json({ success: false, message: 'Categoria deve ter entre 1 e 40 caracteres' });
    }

    const novaDespesa = await Despesa.create({
      descricao: descricaoLimpa,
      valor: valorNumerico,
      categoria: categoriaFinal,
      usuario: req.usuario.id
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

router.get('/financas/despesas', autenticar, async (req, res) => {
  try {
    const despesas = await Despesa.find({ usuario: req.usuario.id }).sort({ data: -1, criadoEm: -1 });
    const total = despesas.reduce((sum, d) => sum + Number(d.valor), 0);
    res.json({ success: true, total, quantidade: despesas.length, data: despesas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao listar despesas' });
  }
});

router.patch('/financas/despesa/:id', autenticar, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID da despesa inválido' });
    }

    const atualizacao = {};
    if (req.body.valor !== undefined) {
      const valorNumerico = Number(String(req.body.valor).replace(',', '.'));
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({ success: false, message: 'Valor deve ser um número positivo' });
      }
      atualizacao.valor = valorNumerico;
    }

    if (req.body.categoria !== undefined) {
      const categoriaFinal = String(req.body.categoria).trim();
      if (!categoriaFinal || categoriaFinal.length > 40) {
        return res.status(400).json({ success: false, message: 'Categoria deve ter entre 1 e 40 caracteres' });
      }
      atualizacao.categoria = categoriaFinal;
    }

    if (Object.keys(atualizacao).length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhuma alteração informada' });
    }

    const despesa = await Despesa.findByIdAndUpdate(
      { _id: req.params.id, usuario: req.usuario.id },
      atualizacao,
      { new: true, runValidators: true }
    );
    if (!despesa) {
      return res.status(404).json({ success: false, message: 'Despesa não encontrada' });
    }

    res.json({ success: true, message: 'Despesa atualizada com sucesso', data: despesa });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar valor' });
  }
});

router.delete('/financas/despesa/:id', autenticar, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID da despesa inválido' });
    }

    const despesa = await Despesa.findOneAndDelete({ _id: req.params.id, usuario: req.usuario.id });
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