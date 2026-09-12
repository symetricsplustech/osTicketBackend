const mongoose = require("mongoose");

const STATUSES = {
  NEW: "new",
  OPEN: "open",
  TRIAGED: "triaged",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  PENDING_CUSTOMER: "pending_customer",
  PENDING_VENDOR: "pending_vendor",
  PENDING_APPROVAL: "pending_approval",
  ON_HOLD: "on_hold",
  ESCALATED: "escalated",
  OVERDUE: "overdue",
  RESOLVED: "resolved",
  VERIFICATION: "verification",
  CLOSED: "closed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
  DUPLICATE: "duplicate",
  SPAM: "spam",
  ARCHIVED: "archived",
  DELETED: "deleted",
};

const ticketSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    escalatedBy: [
      { type: mongoose.Schema.Types.ObjectId, ref: "EscalationRule" },
    ],
    escalationTiersFired: [
      {
        rule: { type: mongoose.Schema.Types.ObjectId, ref: "EscalationRule" },
        tier: { type: Number, default: 0 },
        at: { type: Date, default: Date.now },
      },
    ],
    dept: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HelpTopic",
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(STATUSES),
      default: STATUSES.OPEN,
      index: true,
    },
    priority: {
      type: String,
      default: "Normal",
      index: true,
    },
    // Impact × Urgency inputs (§13): when both are supplied the priority is
    // calculated from the PriorityMatrix instead of taken at face value.
    impact: { type: String, enum: ["low", "medium", "high"], default: null },
    // `normal`/`critical` are retained for existing AI-classified records;
    // the priority matrix itself uses low/medium/high.
    urgency: {
      type: String,
      enum: ["low", "medium", "normal", "high", "critical"],
      default: null,
    },
    sla: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SlaPlan",
      default: null,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
      index: true,
    },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    subject: { type: String, required: true, trim: true, index: true },
    source: {
      type: String,
      enum: ["web", "email", "phone", "api"],
      default: "web",
    },
    dueDate: { type: Date, default: null },
    isOverdue: { type: Boolean, default: false },
    // Separate response + resolution clocks (§14): dueDate stays the
    // resolution clock for backward compatibility.
    responseDueAt: { type: Date, default: null },
    responseMetAt: { type: Date, default: null },
    responseBreached: { type: Boolean, default: false },
    resolutionDueAt: { type: Date, default: null },
    resolutionMetAt: { type: Date, default: null },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    lockedAt: { type: Date, default: null },
    lockExpiresAt: { type: Date, default: null },
    lastActivity: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    // Structured resolution record (§41): required fields enforced on resolve
    // when settings.tickets.requireResolution is on.
    resolution: {
      code: { type: String, default: "" },
      category: { type: String, default: "" },
      rootCause: { type: String, default: "" },
      solution: { type: String, default: "" },
      workaround: { type: String, default: "" },
      timeSpentMinutes: { type: Number, default: null },
      asset: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Asset",
        default: null,
      },
      kbArticle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Faq",
        default: null,
      },
    },
    closedAt: { type: Date, default: null },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
    lastMessageAt: { type: Date, default: null },
    customData: { type: mongoose.Schema.Types.Mixed, default: {} },
    stats: {
      responses: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      firstResponseAt: { type: Date, default: null },
      reopened: { type: Number, default: 0 },
    },
    // ---- Enterprise: AI & intelligence ----
    intent: { type: String, default: "" },
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative", "frustrated"],
      default: "neutral",
    },
    language: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    tags: { type: [String], default: [], index: true },
    aiRisk: { type: Number, default: null },
    complexity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },
    // ---- Enterprise: Advanced SLA ----
    slaType: {
      type: String,
      enum: [
        "first_response",
        "next_response",
        "resolution",
        "update",
        "escalation",
        "callback",
        "approval",
      ],
      default: "first_response",
    },
    slaStartedAt: { type: Date, default: null },
    slaPaused: { type: Boolean, default: false },
    slaPausedAt: { type: Date, default: null },
    slaResumeAt: { type: Date, default: null },
    waitingOn: {
      type: String,
      enum: ["customer", "agent", "vendor", "approval", "none"],
      default: "none",
    },
    // ---- Enterprise: Entity links ----
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      default: null,
    },
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },
    entitlementStatus: {
      type: String,
      enum: ["covered", "not_covered", "pending_approval", "waived", "unknown"],
      default: "unknown",
    },
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      default: null,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      default: null,
    },
    change: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Change",
      default: null,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    // ---- Enterprise: CSAT ----
    csatSentAt: { type: Date, default: null },
    csatRating: { type: Number, default: null },
    csatComment: { type: String, default: "" },
  },
  { timestamps: true },
);

ticketSchema.index({ status: 1, updatedAt: -1 });
ticketSchema.index({ dept: 1, status: 1 });

ticketSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model("Ticket", ticketSchema);
