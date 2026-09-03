const mongoose = require('mongoose');

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não configurada no arquivo .env');

  await mongoose.connect(uri);
  console.log('✅ MongoDB conectado');
}

module.exports = { connectToDatabase };