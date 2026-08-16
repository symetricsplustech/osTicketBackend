const http = require('http');
const dns = require("dns");
const app = require('./app');
const config = require('./config/config');
const connectDB = require('./config/db');
const { setIO } = require('./config/socket');
const { scheduleOverdueCheck } = require('./services/sla.service');
const { startInboundPoller } = require('./services/inboundEmail.service');
const { startEscalationRunner } = require('./services/escalation.service');
const { initWorkflowEngine } = require('./services/workflow.service');
const logger = require('./utils/logger');
const { ensureDefaults } = require('./bootstrap/ensureDefaults');

const DNS_SERVERS = config.dnsServers || ["8.8.8.8", "1.1.1.1"];
dns.setServers(DNS_SERVERS);
const start = async () => {
  await connectDB();
  await ensureDefaults().catch((err) => logger.error(`ensureDefaults failed: ${err.message}`));

  const server = http.createServer(app);
  setIO(server);

  scheduleOverdueCheck();
  startInboundPoller();
  startEscalationRunner();
  initWorkflowEngine();
  require('./services/integration.service');
  const approvalService = require('./services/approval.service');
  const realtime = require('./services/realtime.service');
  setInterval(() => approvalService.runApprovalLifecycle().catch(() => {}), 5 * 60 * 1000);
  setInterval(() => realtime.broadcastSnapshot({}).catch(() => {}), 60 * 1000);

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
