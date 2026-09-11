const { Schema, model } = require('mongoose');
const HolidayCalendarSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  number: { type: String, required: true, unique: true },
  description: { type: String, trim: true, default: '' },
  timezone: { type: String, default: 'UTC' },
  holidays: [{ name: { type: String, required: true }, date: { type: Date, required: true }, endDate: { type: Date }, isRecurring: { type: Boolean, default: false }, type: { type: String, enum: ['public', 'regional', 'company', 'custom'], default: 'company' }, isActive: { type: Boolean, default: true } }],
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  holidayCount: { type: Number, default: 0 },
  scheduleCount: { type: Number, default: 0 },
  meta: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
HolidayCalendarSchema.index({ tenantId: 1, isActive: 1, isDeleted: 1 });
module.exports = model('HolidayCalendar', HolidayCalendarSchema);
