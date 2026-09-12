const StatusPage = require("../models/StatusPage");
const StatusIncident = require("../models/StatusIncident");

async function publicStatus(slug) {
  const page = await StatusPage.findOne({ slug, isPublic: true }).lean();
  if (!page) return null;
  const incidents = await StatusIncident.find({
    statusPage: page._id,
    status: { $nin: ["resolved", "closed"] },
  })
    .sort({ createdAt: -1 })
    .lean();
  return { page, incidents };
}

module.exports = { publicStatus };
