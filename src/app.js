const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config/config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.disable('etag');
app.set('trust proxy', 1);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(compression());
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (config.env === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  windowMs: config.rateLimit.window * 60 * 1000,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/v1/auth/login', limiter);
app.use('/api/v1/auth/register', limiter);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) =>
  res.json({ success: true, message: 'osTicket MERN API', version: '1.0.0' })
);

app.use('/api/v1', routes);

// Serve built frontends in production
if (config.env === 'production') {
  const frontends = [
    { name: 'customer', prefix: '/', dir: '../../frontend/customer/dist' },
    { name: 'agent', prefix: '/agent', dir: '../../frontend/agent/dist' },
    { name: 'admin', prefix: '/admin', dir: '../../frontend/admin/dist' },
    { name: 'superadmin', prefix: '/superadmin', dir: '../../frontend/superadmin/dist' },
  ];
  for (const fe of frontends) {
    const feDir = path.resolve(__dirname, fe.dir);
    app.use(fe.prefix, express.static(feDir));
  }
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    const target = req.path.startsWith('/agent') ? 'agent' : req.path.startsWith('/admin') ? 'admin' : req.path.startsWith('/superadmin') ? 'superadmin' : 'customer';
    const feDir = path.resolve(__dirname, frontends.find((f) => f.name === target).dir);
    res.sendFile(path.join(feDir, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
