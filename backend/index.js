const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectToDatabase } = require('./config/database');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const corsOrigin = process.env.FRONTEND_ORIGIN || true;

app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRoutes);

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
    app.listen(PORT, HOST, () => {
      console.log(`💰 Servidor financeiro: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

startServer();