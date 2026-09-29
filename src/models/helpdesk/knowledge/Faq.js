/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
module.exports = model("faqs", {
  tenant_id: "tenant_id",
  fieldAliases: {
    knowledgeBase: "knowledge_base_id",
    category: "category_id",
  },
});
