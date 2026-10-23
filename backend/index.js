const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
require('dotenv').config();

const { connectToDatabase } = require('./config/database');
const Usuario = require('./models/Usuario');
const apiRoutes = require('./routes/api');
const Sessao = require('./models/Sessao');
const Mensagem = require('./models/Mensagem');
const PushToken = require('./models/PushToken');
const { enviarPush } = require('./services/enviarPush');

async function notificarChat(socket, usuarioId, mensagemId) {
  let pushSent = false;
  try {
    const destinatarios = await PushToken.find({
      usuario: { $ne: usuarioId }
    }).distinct('token');
    const resultado = await enviarPush(destinatarios);
    pushSent = resultado.enviados > 0;
    if (resultado.falhos > 0) {
      console.warn(`Notificações não aceitas pelo serviço: ${resultado.falhos}`);
    }
  } catch (error) {
    console.error('Falha ao enviar notificação do chat:', error.message);
  }

  socket.emit('chat:push-status', { messageId: mensagemId, pushSent });
}

const app = express();
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const HOST = process.env.HOST || '0.0.0.0';
const corsOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => origin.toLowerCase());
const allowedCorsOrigins = [
  'https://controle-financeiro-ruby-mu.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://10.0.2.2:3000',
  ...corsOrigins
];

function validarOrigem(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const normalizedOrigin = origin.toLowerCase();
  const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(normalizedOrigin);

  if (allowedCorsOrigins.includes(normalizedOrigin) || isLocalDevelopmentOrigin) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin não permitida pelo CORS'));
}

app.use(cors({
  origin: validarOrigem,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: validarOrigem, credentials: true }
});
app.set('io', io);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) {
    next(new Error('Faça login para acessar o chat'));
    return;
  }

  let usuario;
  try {
    usuario = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    next(new Error('Sessão inválida ou expirada'));
    return;
  }

  if (!usuario.sid) {
    next(new Error('Sessão inválida ou expirada'));
    return;
  }

  try {
    const sessao = await Sessao.findOne({
      _id: usuario.sid,
      usuario: usuario.id,
      revogadaEm: null,
      ativaAte: { $gt: new Date() },
      expiraEm: { $gt: new Date() }
    }).lean();
    if (!sessao) {
      next(new Error('Sessão encerrada ou expirada'));
      return;
    }

    socket.data.usuario = { id: String(usuario.id), nome: usuario.nome };
    socket.data.sessaoId = String(sessao._id);
    next();
  } catch (error) {
    console.error('Falha ao validar a sessão do chat:', error.message);
    next(new Error('Não foi possível validar a sessão'));
  }
});

io.on('connection', (socket) => {
  socket.join('chat:global');
  const sessionCheck = setInterval(async () => {
    try {
      const sessao = await Sessao.exists({
        _id: socket.data.sessaoId,
        usuario: socket.data.usuario.id,
        revogadaEm: null,
        ativaAte: { $gt: new Date() },
        expiraEm: { $gt: new Date() }
      });
      if (!sessao) socket.disconnect(true);
    } catch (error) {
      console.error('Falha ao renovar autorização do chat:', error.message);
      socket.disconnect(true);
    }
  }, 10000);
  socket.on('disconnect', () => clearInterval(sessionCheck));
  socket.on('chat:send', (payload, acknowledge) => {
    void (async () => {
      const sessao = await Sessao.findOne({
        _id: socket.data.sessaoId,
        usuario: socket.data.usuario.id,
        revogadaEm: null,
        ativaAte: { $gt: new Date() },
        expiraEm: { $gt: new Date() }
      }).lean();
      if (!sessao) {
        if (typeof acknowledge === 'function') {
          acknowledge({ success: false, message: 'Sessão encerrada ou expirada' });
        }
        socket.disconnect(true);
        return;
      }

      const texto = String(payload?.body || '').trim();
      if (!texto || texto.length > 1000) {
        if (typeof acknowledge === 'function') {
          acknowledge({ success: false, message: 'A mensagem deve ter entre 1 e 1000 caracteres' });
        }
        return;
      }

      const criada = await Mensagem.create({
        autor: socket.data.usuario.id,
        nomeAutor: socket.data.usuario.nome,
        texto
      });
      const mensagem = {
        id: String(criada._id),
        authorId: socket.data.usuario.id,
        authorName: socket.data.usuario.nome,
        body: criada.texto,
        createdAt: criada.createdAt
      };
      io.to('chat:global').emit('chat:message', mensagem);
      const messageId = String(criada._id);
      if (typeof acknowledge === 'function') {
        acknowledge({ success: true, messageId, pushPending: true });
      }
      void notificarChat(socket, socket.data.usuario.id, messageId);
    })().catch((error) => {
      console.error('Falha ao processar mensagem do chat:', error.message);
      if (typeof acknowledge === 'function') {
        acknowledge({ success: false, message: 'Não foi possível enviar a mensagem' });
      }
    });
  });
});

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const onListening = () => {
      server.removeListener('error', onError);
      console.log(`💰 Servidor financeiro: http://localhost:${port}`);
      console.log(`🏥 Health: http://localhost:${port}/health`);
      resolve(server);
    };

    const onError = (error) => {
      server.removeListener('listening', onListening);
      if (error.code === 'EADDRINUSE') {
        const fallbackPort = port + 1;
        console.warn(`Porta ${port} ocupada. Tentando ${fallbackPort}...`);
        setImmediate(() => listenOnPort(fallbackPort).then(resolve, reject));
        return;
      }

      reject(error);
    };

    server.once('listening', onListening);
    server.once('error', onError);
    server.listen(port, HOST);
  });
}

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'API de Finanças',
    version: '1.0.0',
    endpoints: {
      cadastrar: 'POST /api/financas/despesa',
      listar: 'GET /api/financas/despesas',
      deletar: 'DELETE /api/financas/despesa/:id'
    }
  });
});

async function startServer() {
  try {
    await connectToDatabase();
    await provisionarAdministrador();
    await listenOnPort(PORT);
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

async function provisionarAdministrador() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = String(process.env.ADMIN_PASSWORD || '');
  if (!email && !senha) return;
  if (!/^\S+@\S+\.\S+$/.test(email) || senha.length < 12) {
    throw new Error('Configure ADMIN_EMAIL válido e ADMIN_PASSWORD com pelo menos 12 caracteres');
  }

  const existente = await Usuario.findOne({ email });
  if (existente) {
    if (existente.perfil !== 'administrador') {
      existente.perfil = 'administrador';
      await existente.save();
    }
    return;
  }

  const nome = String(process.env.ADMIN_NAME || 'Administrador').trim();
  await Usuario.create({
    nome: nome.length >= 2 && nome.length <= 80 ? nome : 'Administrador',
    email,
    senha: await bcrypt.hash(senha, 12),
    perfil: 'administrador'
  });
}

startServer();