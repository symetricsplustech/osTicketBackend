/**
 * KnowledgeVersion — version history for knowledge articles.
 * Every edit creates a new version snapshot.
 */
const { Schema, model } = require("mongoose");

const KnowledgeVersionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Faq",
      required: true,
      index: true,
    },
    version: { type: Number, required: true, index: true },

    // Snapshot of article at this version
    question: { type: String, required: true },
    answer: { type: String, required: true },
    keywords: [{ type: String }],
    category: { type: Schema.Types.ObjectId, ref: "FaqCategory" },
    visibility: {
      type: String,
      enum: [
        "public",
        "customers",
        "employees",
        "agents",
        "department",
        "team",
      ],
    },
    internalOnly: { type: Boolean, default: false },
    lifecycle: {
      type: String,
      enum: ["draft", "review", "approved", "published", "expired", "archived"],
    },

    // Metadata
    changeSummary: { type: String, trim: true, default: "" },
    changeType: {
      type: String,
      enum: ["create", "edit", "publish", "retire", "restore"],
      default: "edit",
    },

    // Author
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },

    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

KnowledgeVersionSchema.index({ tenantId: 1, articleId: 1, version: -1 });
KnowledgeVersionSchema.index({ tenantId: 1, articleId: 1, createdAt: -1 });

module.exports = model("KnowledgeVersion", KnowledgeVersionSchema);
