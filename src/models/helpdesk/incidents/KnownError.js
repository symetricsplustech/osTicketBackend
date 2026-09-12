const mongoose = require("mongoose");

const knownErrorSchema = new mongoose.Schema(
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
    rootCause: { type: String, default: "" },
    workaround: { type: String, default: "" },
    impact: { type: String, default: "" },
    affectedServices: [{ type: String }],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

knownErrorSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model("KnownError", knownErrorSchema);
