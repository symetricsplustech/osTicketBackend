/**
 * Automatic conflict recalculation for scheduled changes.
 * Runs every 10 minutes.
 */
const Change = require('../models/helpdesk/incidents/Change');
const ChangeConflict = require('../models/helpdesk/incidents/ChangeConflict');
const events = require('../services/events');

const BATCH_SIZE = 50;

async function recalculateConflicts() {
  const scheduledChanges = await Change.find({
    status: 'scheduled',
    isActive: true,
    windowStart: { $gte: new Date() },
  }).limit(BATCH_SIZE);

  let totalConflicts = 0;

  for (const change of scheduledChanges) {
    await ChangeConflict.deleteMany({ change: change._id, isResolved: false });

    const overlapping = await Change.find({
      _id: { $ne: change._id },
      company: change.company,
      isActive: true,
      status: 'scheduled',
      windowStart: { $lt: change.windowEnd },
      windowEnd: { $gt: change.windowStart },
    });

    for (const ov of overlapping) {
      await ChangeConflict.create({
        change: change._id,
        conflictingChange: ov._id,
        company: change.company,
        conflictType: 'schedule_overlap',
        description: `Overlaps with ${ov.number}`,
      });
      totalConflicts++;
    }
  }

  return { evaluated: scheduledChanges.length, conflictsFound: totalConflicts };
}

module.exports = { recalculateConflicts };
