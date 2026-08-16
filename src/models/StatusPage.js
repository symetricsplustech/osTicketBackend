const mongoose = require('mongoose');

const statusPageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true },
    description: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    branding: {
      logo: { type: String, default: '' },
      primaryColor: { type: String, default: '#2563eb' },
      notes: { type: String, default: '' },
    },
    components: [
      {
        name: { type: String, required: true },
        group: { type: String, default: '' },
        status: {
          type: String,
          enum: ['operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'],
          default: 'operational',
        },
        order: { type: Number, default: 0 },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', default: null },
  },
  { timestamps: true }
);

statusPageSchema.index({ company: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('StatusPage', statusPageSchema);