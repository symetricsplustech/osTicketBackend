const mongoose = require('mongoose');
const departmentTransferSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  toDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  effectiveDate: Date,
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  checklist: [{ task: String, status: { type: String, enum: ['pending', 'completed'], default: 'pending' } }],
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });
module.exports = mongoose.models.DepartmentTransfer || mongoose.model('DepartmentTransfer', departmentTransferSchema);
