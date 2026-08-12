const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');

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
  try {
    await connectDB();
  } catch (err) {
    cached.promise = null;
    res.status(500).json({ success: false, message: 'Database connection failed' });
    return;
  }
  app(req, res);
};
