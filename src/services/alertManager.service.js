const crypto = require('crypto');
const Alert = require('../models/Alert');
const Incident = require('../models/helpdesk/incidents/Incident');

async function ingestAlert({ company, title, message, severity, source, resource, service, metric, threshold, currentValue, labels }) {
  const dedupeKey = crypto.createHash('sha256')
    .update(`${company}${source || ''}${service || ''}${metric || ''}${title || ''}`)
    .digest('hex')
    .slice(0, 16);

  const existing = await Alert.findOne({
    company,
    dedupeKey,
    status: { $in: ['firing', 'acknowledged'] },
  });

  let alert;
  if (existing) {
    existing.currentValue = currentValue || existing.currentValue;
    existing.count = (existing.count || 1) + 1;
    existing.labels = labels || existing.labels;
    await existing.save();
    alert = existing;
  } else {
    alert = await Alert.create({
      company,
      title,
      message,
      severity,
      status: 'firing',
      source,
      resource,
      service,
      metric,
      threshold,
      currentValue,
      dedupeKey,
      count: 1,
      labels,
    });
  }

  if ((severity === 'critical' || severity === 'emergency') && !alert.incident) {
    const incident = await Incident.create({
      company,
      subject: [title],
      details: message || title,
      priority: severity === 'emergency' ? 'Critical' : 'High',
      status: 'open',
      source: 'alert',
      alert: alert._id,
    });
    alert.incident = incident._id;
    await alert.save();
  }

  return alert;
}

module.exports = { ingestAlert };
