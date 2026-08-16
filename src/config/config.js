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
    // Inbound email-to-ticket (IMAP polling). The helpdesk inbox receives customer emails.
    imapHost: process.env.EMAIL_IMAP_HOST || (process.env.EMAIL_HOST === 'smtp.gmail.com' ? 'imap.gmail.com' : process.env.EMAIL_HOST),
    imapPort: parseInt(process.env.EMAIL_IMAP_PORT, 10) || 993,
    imapSecure: process.env.EMAIL_IMAP_SECURE !== 'false',
    imapUser: process.env.EMAIL_IMAP_USER || process.env.EMAIL_USER,
    imapPassword: process.env.EMAIL_IMAP_PASSWORD || process.env.EMAIL_PASSWORD,
    imapMailbox: process.env.EMAIL_IMAP_MAILBOX || 'INBOX',
    imapPollInterval: parseInt(process.env.EMAIL_POLL_INTERVAL, 10) || 60000,
    imapWindowDays: parseInt(process.env.EMAIL_INBOUND_WINDOW_DAYS, 10) || 1,
    imapEnabled: !!((process.env.EMAIL_HOST && process.env.EMAIL_USER) && process.env.EMAIL_IMAP_ENABLED !== 'false'),
    // Public address customers email to create a ticket. Falls back to the helpdesk inbox.
    emailToTicket: process.env.EMAIL_TO_TICKET_ADDRESS || process.env.EMAIL_USER || '',
  },
  urls: {
    client: process.env.CLIENT_URL || 'http://localhost:5173',
    agent: process.env.AGENT_URL || 'http://localhost:5174',
    admin: process.env.ADMIN_URL || 'http://localhost:5175',
    superadmin: process.env.SUPERADMIN_URL || 'http://localhost:5176',
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176')
    .split(',')
    .map((s) => s.trim()),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    enabled: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  },
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  rateLimit: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  },
  escalation: {
    enabled: process.env.ESCALATION_ENABLED === 'true',
    intervalMinutes: parseInt(process.env.ESCALATION_INTERVAL_MINUTES, 10) || 5,
  },
  ai: {
    // Provider-agnostic: any OpenAI-compatible chat completions endpoint
    provider: process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'none'),
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS, 10) || 500,
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 15000,
    // Auto-resolution: AI replies to simple tickets when confident
    autoResolveEnabled: process.env.AI_AUTORESOLVE_ENABLED === 'true',
    autoResolveThreshold: parseFloat(process.env.AI_AUTORESOLVE_THRESHOLD || '0.8'),
  },
  workflow: {
    timerIntervalMinutes: parseInt(process.env.WORKFLOW_TIMER_INTERVAL_MINUTES, 10) || 5,
  },
  sla: {
    overdueIntervalMinutes: parseInt(process.env.SLA_OVERDUE_INTERVAL_MINUTES, 10) || 5,
    warningThresholdHours: parseFloat(process.env.SLA_WARNING_THRESHOLD_HOURS || '2'),
  },
};

module.exports = config;
