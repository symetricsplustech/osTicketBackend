const mongoose = require('mongoose');

// RPA / Page Builder (checklist §19.11)
const savedPageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: '' },
    kind: { type: String, enum: ['workspace', 'dashboard', 'wizard', 'report'], default: 'workspace' },
    // Workflow-style canvas definition
    layout: {
      nodes: [
        {
          id: String,
          component: String, // 'table','form','chart','card','text','filter','action_button'
          props: mongoose.Schema.Types.Mixed,
          position: { x: Number, y: Number, w: Number, h: Number },
        },
      ],
      edges: [{ from: String, to: String, condition: String }], // conditional display based on form state
      dataSources: [
        {
          id: String,
          entity: String, // CRUD entity name
          query: mongoose.Schema.Types.Mixed,
          refreshIntervalSec: Number,
        },
      ],
      actions: [
        {
          id: String,
          on: String, // 'click','submit','load'
          type: { type: String, enum: ['navigate', 'mutate', 'call_workflow', 'show_toast', 'open_drawer'] },
          target: String,
          payload: mongoose.Schema.Types.Mixed,
        },
      ],
    },
    accessRoles: [String], // roles permitted to view (empty = all authenticated)
    published: { type: Boolean, default: false },
    publishedAt: Date,
    publishedBy: mongoose.Schema.Types.ObjectId,
    versions: [
      {
        n: Number,
        snapshot: mongoose.Schema.Types.Mixed,
        note: String,
        by: mongoose.Schema.Types.ObjectId,
        at: { type: Date, default: Date.now },
      },
    ],
    tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  },
  { timestamps: true }
);
savedPageSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.models.SavedPage || mongoose.model('SavedPage', savedPageSchema);
