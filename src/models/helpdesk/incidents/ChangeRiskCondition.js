const mongoose = require('mongoose');

const changeRiskConditionSchema = new mongoose.Schema(
  {
    riskAssessment: { type: mongoose.Schema.Types.ObjectId, ref: 'ChangeRiskAssessment', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    condition: { type: String, required: true },
    threshold: { type: String, default: '' },
    currentValue: { type: String, default: '' },
    isMet: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChangeRiskCondition', changeRiskConditionSchema);
