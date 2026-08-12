const http = require('http');
const app = require('./app');
const config = require('./config/config');
const connectDB = require('./config/db');
const { setIO } = require('./config/socket');
const { scheduleOverdueCheck } = require('./services/sla.service');
const { startInboundPoller } = require('./services/inboundEmail.service');
const { startEscalationRunner } = require('./services/escalation.service');
const logger = require('./utils/logger');

const start = async () => {
  await connectDB();

  const server = http.createServer(app);
  setIO(server);

  scheduleOverdueCheck();
  startInboundPoller();
  startEscalationRunner();

  server.listen(config.port, () => {
    logger.info(`osTicket MERN API running on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start();
