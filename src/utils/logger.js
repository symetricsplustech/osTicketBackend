const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '../logs');
try {
  fs.mkdirSync(dir, { recursive: true });
} catch (err) {
  // no writable logs directory (e.g. Vercel serverless) — console only
}

const levels = { error: 0, warn: 1, info: 2, debug: 3 };

function write(level, msg) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    fs.appendFileSync(path.join(dir, `${level}.log`), line);
  } catch (err) {
    // ignore log write errors
  }
}

function log(level, msg) {
  if (levels[level] === undefined) level = 'info';
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  if (level === 'error') console.error(line);
  else console.log(line);
  write(level, msg);
}

module.exports = {
  error: (msg) => log('error', msg),
  warn: (msg) => log('warn', msg),
  info: (msg) => log('info', msg),
  debug: (msg) => log('debug', msg),
};
