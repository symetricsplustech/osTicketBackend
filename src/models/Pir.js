const mongoose = require("mongoose");

const pirSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    change: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Change",
      default: null,
      index: true,
    },
    plannedDate: { type: Date, default: null },
    completedDate: { type: Date, default: null },
    lessonsLearned: { type: String, default: "" },
    outcome: { type: String, default: "" },
    riskRating: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved", "published"],
      default: "draft",
    },
    questions: [
      {
        question: { type: String, default: "" },
        answer: { type: String, default: "" },
        category: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true },
);

pirSchema.index({ company: 1, status: 1 });

module.exports = mongoose.model("Pir", pirSchema);