const mongoose = require('mongoose');

function normalizeMongoUri(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  return rawValue.replace(/^MONGODB_URI\s*=\s*/i, '').trim();
}

async function connectToDatabase() {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);
  if (!uri) throw new Error('MONGODB_URI não configurada no arquivo .env');

  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('MONGODB_URI inválida. Use um valor como mongodb://... ou mongodb+srv://...');
  }

  await mongoose.connect(uri);
  console.log('✅ MongoDB conectado');
}

module.exports = { connectToDatabase, normalizeMongoUri };