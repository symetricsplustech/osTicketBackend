/**
 * ERP adapters (checklist §17.6).
 * Each adapter is env-gated: set ERP_<NAME>_ENABLED=1 + ERP_<NAME>_URL + ERP_<NAME>_KEY
 * to activate. Adapters expose a thin `push(entity, operation, record)` → HTTP POST/PUT.
 */
const https = require('https');
const http = require('http');

function makeTransport(baseUrl, headers = {}) {
  return function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const payload = body ? JSON.stringify(body) : null;
      const opts = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload ? Buffer.byteLength(payload) : 0,
          ...headers,
        },
      };
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch (_) { resolve({ raw: data }); }
          } else {
            reject(new Error(`ERP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };
}

function envKey(name, suffix) {
  return `ERP_${name.toUpperCase()}_${suffix}`;
}

function adapterEnabled(name) {
  return process.env[envKey(name, 'ENABLED')] === '1' || process.env[envKey(name, 'ENABLED')] === 'true';
}

const definitions = {
  m365: {
    name: 'Microsoft 365',
    config: () => ({
      url: process.env[envKey('m365', 'URL')],
      key: process.env[envKey('m365', 'KEY')],
      tenantId: process.env[envKey('m365', 'TENANT_ID')],
    }),
    transport: (c) => makeTransport(c.url, { Authorization: `Bearer ${c.key}`, 'x-ms-tenant-id': c.tenantId }),
  },
  slack: {
    name: 'Slack',
    config: () => ({
      url: process.env[envKey('slack', 'URL')],
      token: process.env[envKey('slack', 'TOKEN')],
    }),
    transport: (c) => makeTransport(c.url, { Authorization: `Bearer ${c.token}` }),
  },
  jira: {
    name: 'Jira',
    config: () => ({
      url: process.env[envKey('jira', 'URL')],
      email: process.env[envKey('jira', 'EMAIL')],
      token: process.env[envKey('jira', 'API_TOKEN')],
    }),
    transport: (c) =>
      makeTransport(c.url, {
        Authorization: `Basic ${Buffer.from(`${c.email}:${c.token}`).toString('base64')}`,
      }),
  },
  github: {
    name: 'GitHub',
    config: () => ({
      url: process.env[envKey('github', 'URL')],
      token: process.env[envKey('github', 'TOKEN')],
    }),
    transport: (c) => makeTransport(c.url, { Authorization: `token ${c.token}` }),
  },
  sap: {
    name: 'SAP',
    config: () => ({
      url: process.env[envKey('sap', 'URL')],
      user: process.env[envKey('sap', 'USER')],
      pass: process.env[envKey('sap', 'PASS')],
    }),
    transport: (c) =>
      makeTransport(c.url, {
        Authorization: `Basic ${Buffer.from(`${c.user}:${c.pass}`).toString('base64')}`,
      }),
  },
};

const adapters = {};

for (const [key, def] of Object.entries(definitions)) {
  if (!adapterEnabled(key)) continue;
  const cfg = def.config();
  if (!cfg.url) continue;
  adapters[key] = {
    name: def.name,
    enabled: true,
    getTransport: () => def.transport(cfg),
    push: async (entityType, operation, record) => {
      const transport = def.transport(cfg);
      const path = `/${entityType.toLowerCase()}/sync`;
      return transport('POST', path, { operation, record: { ...record, _meta: { entityType, source: 'osTicket' } } });
    },
    health: async () => {
      try {
        const transport = def.transport(cfg);
        await transport('GET', '/health').catch(() => {});
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
  };
}

function listAdapters() {
  return Object.entries(adapters).map(([key, a]) => ({ key, name: a.name, enabled: true }));
}

module.exports = { adapters, listAdapters, adapterEnabled };
