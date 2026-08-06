const SlaPlan = require('../models/SlaPlan');
const config = require('../config/config');

const addBusinessHours = (date, hours) => {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
};

const computeDueDate = async (sla, startDate = new Date()) => {
  if (!sla) return null;
  const plan = await SlaPlan.findById(sla);
  if (!plan) return null;
  if (plan.schedule === '24/7') {
    return addBusinessHours(startDate, plan.gracePeriod);
  }
  // Business hours: 9am - 5pm Mon-Fri
  let due = new Date(startDate);
  let remaining = plan.gracePeriod;
  while (remaining > 0) {
    due = new Date(due.getTime() + 60 * 60 * 1000);
    const day = due.getDay();
    const hour = due.getHours();
    const isBusinessHour = day >= 1 && day <= 5 && hour >= 9 && hour < 17;
    if (isBusinessHour) remaining -= 1;
  }
  return due;
};

const markOverdueTickets = async () => {
  const Ticket = require('../models/Ticket');
  const now = new Date();
  const result = await Ticket.updateMany(
    {
      dueDate: { $ne: null, $lte: now },
      isOverdue: false,
      status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.ARCHIVED, Ticket.STATUSES.DELETED] },
    },
    { $set: { isOverdue: true, status: Ticket.STATUSES.OVERDUE } }
  );
  return result;
};

const scheduleOverdueCheck = () => {
  const minutes = 5;
  setInterval(async () => {
    try {
      await markOverdueTickets();
    } catch (err) {
      // ignore
    }
  }, minutes * 60 * 1000);
};

module.exports = { computeDueDate, markOverdueTickets, scheduleOverdueCheck };
