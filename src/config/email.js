const nodemailer = require('nodemailer');
const config = require('./config');
const logger = require('../utils/logger');

let transporter = null;

if (config.email.enabled) {
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });
}

module.exports = {
  transporter,
  enabled: config.email.enabled,
  from: config.email.from,
  logger,
};
