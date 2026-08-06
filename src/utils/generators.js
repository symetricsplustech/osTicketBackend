const crypto = require('crypto');

const generateTicketNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${ts}${rand}`.slice(0, 12);
};

const generateAuthToken = () => {
  return crypto.randomBytes(20).toString('hex');
};

const generateConfirmationToken = () => {
  return crypto.randomBytes(24).toString('hex');
};

module.exports = { generateTicketNumber, generateAuthToken, generateConfirmationToken };
