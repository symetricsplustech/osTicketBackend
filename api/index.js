const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const { ensureDefaults } = require('../src/bootstrap/ensureDefaults');

let cached = global.__ostMongooseConn;
if (!cached) {
  cached = global.__ostMongooseConn = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 })
      .then((m) => m.connection);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = async (req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  try {
    await connectDB();
    await ensureDefaults().catch((err) => console.error('ensureDefaults failed:', err.message));
  } catch (err) {
    cached.promise = null;
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Database connection failed' }));
    return;
  }
  app(req, res);
};
