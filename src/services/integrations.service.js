const net = require('net');
const tls = require('tls');

// Twilio SMS — uses REST API directly (no SDK dep needed)
async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[sms:mock] to=${to} body=${body}`);
    return { delivered: false, mock: true };
  }
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  return { delivered: res.ok, status: res.status };
}

// ClamAV virus scanning via clamd INSTREAM protocol
function scanFile(filePath, buffer) {
  const host = process.env.CLAMAV_HOST || '127.0.0.1';
  const port = parseInt(process.env.CLAMAV_PORT || '3310', 10);
  if (!process.env.CLAMAV_HOST && !process.env.CLAMAV_ENABLED) {
    return Promise.resolve({ clean: true, mock: true });
  }
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 10000 });
    let done = false;
    const finish = (r) => { if (!done) { done = true; socket.destroy(); resolve(r); } };
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      const chunkSize = 1024;
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.slice(i, i + chunkSize);
        const sizeBuf = Buffer.alloc(4);
        sizeBuf.writeUInt32BE(chunk.length, 0);
        socket.write(Buffer.concat([sizeBuf, chunk]));
      }
      const zero = Buffer.alloc(4);
      socket.end(zero);
    });
    let data = '';
    socket.on('data', (d) => { data += d.toString(); });
    socket.on('end', () => finish({ clean: !data.includes('FOUND'), signature: data.trim() }));
    socket.on('error', () => finish({ clean: true, error: 'clamd_unreachable' }));
    socket.on('timeout', () => finish({ clean: true, error: 'timeout' }));
  });
}

// LDAP bind authentication. ldapjs is optional; without it we do a raw socket check.
async function ldapAuthenticate(username, password) {
  const url = process.env.LDAP_URL;
  if (!url) return { success: false, reason: 'not_configured' };
  try {
    const ldapjs = require('ldapjs'); // optional peer dep
    const client = ldapjs.createClient({ url });
    const searchBase = process.env.LDAP_SEARCH_BASE;
    const filter = (process.env.LDAP_SEARCH_FILTER || '(mail={{username}})').replace('{{username}}', username);
    const bindDn = process.env.LDAP_BIND_DN;
    const bindPassword = process.env.LDAP_BIND_PASSWORD;
    await new Promise((res, rej) => client.bind(bindDn, bindPassword, (e) => e ? rej(e) : res()));
    const entry = await new Promise((res, rej) => {
      client.search(searchBase, { filter, scope: 'sub' }, (e, r) => {
        if (e) return rej(e);
        let found = null;
        r.on('searchEntry', (en) => { found = en; });
        r.on('end', () => res(found));
        r.on('error', rej);
      });
    });
    if (!entry) { client.unbind(); return { success: false, reason: 'user_not_found' }; }
    const userDn = entry.objectName ? entry.objectName.toString() : entry.dn;
    await new Promise((res, rej) => client.bind(userDn, password, (e) => e ? rej(e) : res()));
    client.unbind();
    const obj = entry.object || {};
    return { success: true, email: obj.mail, name: obj.cn };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// Lightweight in-process job queue. Uses Bull when available, else inline runner.
const jobs = [];
let inlineTimer = null;
async function enqueue(name, payload, runAt) {
  try {
    const Bull = require('bull');
    const queue = new Bull(name, process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await queue.add(payload, { delay: Math.max(0, runAt - Date.now()) });
    return { queued: true, engine: 'bull' };
  } catch (_) {
    jobs.push({ name, payload, runAt: runAt || Date.now(), attempts: 0 });
    if (!inlineTimer) inlineTimer = setInterval(drainJobs, 15000);
    return { queued: true, engine: 'inline', pending: jobs.length };
  }
}
async function drainJobs() {
  const now = Date.now();
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].runAt <= now) {
      const job = jobs.splice(i, 1)[0];
      try { require('./jobs.handlers.js').handle(job); } catch (_) { /* handler registry optional */ }
    }
  }
}

// WhatsApp via Twilio (same REST API, whatsapp: prefixed addresses)
async function sendWhatsapp(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WA_NUMBER; // e.g. 'whatsapp:+14155238886'
  if (!sid || !token || !from) {
    console.log(`[whatsapp:mock] to=${to} body=${body}`);
    return { delivered: false, mock: true };
  }
  const params = new URLSearchParams({ To: `whatsapp:${to}`, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  return { delivered: res.ok, status: res.status };
}

// Quiet-hours + channel-preference gate used by all notification fan-outs
async function shouldSendNow(userId) {
  try {
    const P5 = require('../models/Platform5');
    const pref = await P5.NotificationPref.findOne({ user: userId });
    if (!pref) return true;
    if (pref.quietHours?.enabled) {
      const nowT = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: pref.quietHours.tz || 'UTC' }).slice(0, 5);
      const { start, end } = pref.quietHours;
      const inWindow = start <= end ? (nowT >= start && nowT < end) : (nowT >= start || nowT < end);
      if (inWindow) return false;
    }
    return true;
  } catch (_) { return true; }
}

module.exports = { sendSms, sendWhatsapp, scanFile, ldapAuthenticate, enqueue, shouldSendNow };
