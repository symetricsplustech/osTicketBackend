const mongoose = require("mongoose");

const problemTaskSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, index: true },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: [
        "new",
        "open",
        "in_progress",
        "pending_customer",
        "pending_vendor",
        "pending_approval",
        "on_hold",
        "resolved",
        "closed",
        "cancelled",
      ],
      default: "new",
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Emergency"],
      default: "Normal",
    },
    assignmentGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    dueAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

problemTaskSchema.index({ company: 1, problem: 1 });
problemTaskSchema.index({ company: 1, status: 1 });
problemTaskSchema.index({ company: 1, assignedTo: 1 });
problemTaskSchema.index({ isActive: 1, deletedAt: 1 });

problemTaskSchema.statics.STATUSES = [
  "new",
  "open",
  "in_progress",
  "pending_customer",
  "pending_vendor",
  "pending_approval",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
];

module.exports = mongoose.model("ProblemTask", problemTaskSchema);
