/* eslint-disable no-console */
const mongoose = require('mongoose');
const config = require('../src/config/config');
const { pollInbox } = require('../src/services/inboundEmail.service');

const sinceDays = (() => {
  const idx = process.argv.indexOf('--since-days');
  if (idx !== -1 && process.argv[idx + 1]) return parseInt(process.argv[idx + 1], 10);
  return config.email.imapWindowDays;
})();

const run = async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log(`Polling ${config.email.imapUser}@${config.email.imapHost} (last ${sinceDays} day(s))...`);
  const summary = await pollInbox({ sinceDays });
  console.log('Poll summary:', JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Inbound email fetch failed:', err.message);
  process.exit(1);
});
