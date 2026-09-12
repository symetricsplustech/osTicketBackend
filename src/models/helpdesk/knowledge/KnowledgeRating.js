/**
 * KnowledgeRating — numeric ratings for knowledge articles.
 * One rating per user per article, updatable.
 */
const { Schema, model } = require("mongoose");

const KnowledgeRatingSchema = new Schema(
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
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

KnowledgeRatingSchema.index(
  { tenantId: 1, articleId: 1, userId: 1 },
  { unique: true },
);

module.exports = model("KnowledgeRating", KnowledgeRatingSchema);
