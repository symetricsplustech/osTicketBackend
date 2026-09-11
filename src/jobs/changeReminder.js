/**
 * Scheduled change reminders.
 * Runs every 30 minutes.
 */
const Change = require('../models/helpdesk/incidents/Change');
const events = require('../services/events');

const REMINDER_HOURS = [24, 4];

async function checkScheduledChangeReminders() {
  const now = new Date();
  let notified = 0;

  for (const hours of REMINDER_HOURS) {
    const target = new Date(now.getTime() + hours * 3600000);
    const threshold = new Date(target.getTime() + 30 * 60000);

    const changes = await Change.find({
      status: 'scheduled',
      isActive: true,
      windowStart: { $gte: target, $lte: threshold },
    });

    for (const change of changes) {
      events.emit('change.reminder', {
        changeId: change._id,
        tenantId: change.company,
        number: change.number,
        title: change.title,
        windowStart: change.windowStart,
        hoursUntil: hours,
      });
      notified++;
    }
  }

  return { notified };
}

module.exports = { checkScheduledChangeReminders };
