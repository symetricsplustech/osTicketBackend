const mongoose = require("mongoose");

const ticketTemplateSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    category: { type: String, default: "General" },
    priority: { type: String, default: "Normal" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      default: null,
    },
  },
  { timestamps: true },
);

ticketTemplateSchema.index({ company: 1, category: 1 });

module.exports = mongoose.model("TicketTemplate", ticketTemplateSchema);