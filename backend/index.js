const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectToDatabase } = require('./config/database');
const apiRoutes = require('./routes/api');

const app = express();
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const HOST = process.env.HOST || '0.0.0.0';
const corsOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = [
  'https://controle-financeiro-ruby-mu.vercel.app',
  ...corsOrigins
];

app.use(cors({
  origin: allowedCorsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRoutes);

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST, () => {
      console.log(`💰 Servidor financeiro: http://localhost:${port}`);
      console.log(`🏥 Health: http://localhost:${port}/health`);
      resolve(server);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        const fallbackPort = port + 1;
        console.warn(`Porta ${port} ocupada. Tentando ${fallbackPort}...`);
        resolve(listenOnPort(fallbackPort));
        return;
      }

      reject(error);
    });
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
    await listenOnPort(PORT);
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

startServer();