// Self-service access only. Operational console access must come from an
// instance membership grant, never from public registration.
const DEFAULT_REQUESTER_PERMISSIONS = [
  "itsm.request_catalog.catalog_item.read",
  "itsm.request_catalog.ui.catalog_home.access",
  "itsm.request_catalog.request.read",
  "itsm.request_catalog.ui.req_detail.access",
  "itsm.knowledge.knowledge_article.read",
  "itsm.knowledge.ui.knowledge_search.access",
  "itsm.approval.approval_read",
  "itsm.approval.ui.my_approvals.access",
];

module.exports = { DEFAULT_REQUESTER_PERMISSIONS };
