const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    number: { type: String, required: true, unique: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', default: null },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'], default: 'draft' },
    items: [{
      description: { type: String, required: true },
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number, required: true },
      total: { type: Number, default: 0 },
    }],
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    validUntil: { type: Date, default: null },
    notes: { type: String, default: '' },
    terms: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

quoteSchema.index({ company: 1, status: 1 });
quoteSchema.index({ number: 1 });

quoteSchema.pre('save', function (next) {
  this.items.forEach(item => { item.total = item.quantity * item.unitPrice; });
  this.subtotal = this.items.reduce((sum, i) => sum + i.total, 0);
  this.total = this.subtotal + this.tax - this.discount;
  next();
});

module.exports = mongoose.model('Quote', quoteSchema);
