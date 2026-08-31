const mongoose = require('mongoose');
const monitoringTicketSchema = new mongoose.Schema({
  source: { type: String, enum: ['nagios', 'zabbix', 'datadog', 'prometheus', 'cloudwatch', 'custom'], required: true },
  alertId: String,
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  alertData: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ['received', 'ticket_created', 'ignored', 'error'], default: 'received' },
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
}, { timestamps: true });
module.exports = mongoose.models.MonitoringTicket || mongoose.model('MonitoringTicket', monitoringTicketSchema);
