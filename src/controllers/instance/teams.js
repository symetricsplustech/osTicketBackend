const Team = require("../../models/Team");
const asyncHandler = require("../../utils/asyncHandler");
const links = require("../../services/organizationRecordLink.service");

exports.list = asyncHandler(async (req, res) => {
  const items = await links.listRecords(Team, req.params.instanceId);
  res.json({ success: true, items });
});

exports.linkUnit = asyncHandler(async (req, res) => {
  const item = await links.linkRecord({
    Model: Team, type: "team", label: "Team",
    company: req.params.instanceId, recordId: req.params.teamId,
    unitId: req.body.organizationUnit,
  });
  res.json({ success: true, item });
});
