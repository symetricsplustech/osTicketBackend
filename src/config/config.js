const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/osticket_mern',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'osTicket Support <support@osticket.local>',
    enabled: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER),
  },
  urls: {
    client: process.env.CLIENT_URL || 'http://localhost:5173',
    agent: process.env.AGENT_URL || 'http://localhost:5174',
    admin: process.env.ADMIN_URL || 'http://localhost:5175',
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175')
    .split(',')
    .map((s) => s.trim()),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  rateLimit: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  },
};

module.exports = config;
