const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FaqCategory",
      default: null,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    knowledgeBaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeBase",
      index: true,
    },
    number: { type: String, unique: true, sparse: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    shortSummary: { type: String, trim: true, default: "" },
    keywords: { type: [String], default: [] },
    isPublished: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    views: { type: Number, default: 0 },
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    // ---- Enterprise: Knowledge lifecycle ----
    lifecycle: {
      type: String,
      enum: ["draft", "review", "approved", "published", "expired", "archived"],
      default: "published",
    },
    expiresAt: { type: Date, default: null },
    internalOnly: { type: Boolean, default: false },
    // Visibility scopes (§28). internalOnly=true behaves as `agents`.
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
      default: "public",
    },
    visibleDepartments: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    ],
    visibleTeams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Team" }],
    locale: { type: String, default: "" },
    relatedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ticket" }],
    relatedProducts: { type: [String], default: [] },
    // ---- Module 06 enhancements ----
    // Versioning
    version: { type: Number, default: 1 },
    maxVersion: { type: Number, default: 1 },
    lastVersionedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastVersionedAt: { type: Date },
    // Article linking
    relatedArticles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Faq" }],
    primaryKnownError: { type: mongoose.Schema.Types.ObjectId, ref: "Problem" },
    linkedIncidents: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Incident" },
    ],
    linkedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: "Problem" }],
    linkedChanges: [{ type: mongoose.Schema.Types.ObjectId, ref: "Change" }],
    // Metrics
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    feedbackCount: { type: Number, default: 0 },
    // Analytics
    analytics: {
      searches: { type: Number, default: 0 },
      lastViewAt: { type: Date, default: null },
      lastEditedAt: { type: Date, default: null },
      lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    // Scheduling
    scheduledPublishAt: { type: Date },
    scheduledRetireAt: { type: Date },
    publishedAt: { type: Date },
    retiredAt: { type: Date },
  },
  { timestamps: true },
);

faqSchema.index({ question: "text", answer: "text", keywords: "text" });
faqSchema.index({ company: 1, lifecycle: 1, isPublished: 1 });
faqSchema.index({ company: 1, knowledgeBaseId: 1, lifecycle: 1 });

module.exports = mongoose.model("Faq", faqSchema);
