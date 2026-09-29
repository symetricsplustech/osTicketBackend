const Team = require("../../models/Team");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const links = require("../../services/organizationRecordLink.service");

exports.list = asyncHandler(async (req, res) => {
  const items = await links.listRecords(Team, req.params.instanceId);
  res.json({ success: true, items });
});

exports.get = asyncHandler(async (req, res) => {
  const item = await Team.findById(req.params.teamId);
  if (!item) throw new ApiError(404, "Team not found");
  res.json({ success: true, item });
});

exports.create = asyncHandler(async (req, res) => {
  const instance = req.params.instanceId;
  const item = await Team.create({
    name: req.body.name,
    company_id: instance,
    members: req.body.members || [],
  });
  res.status(201).json({ success: true, item });
});

exports.update = asyncHandler(async (req, res) => {
  const item = await Team.findById(req.params.teamId);
  if (!item) throw new ApiError(404, "Team not found");
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new ApiError(422, "Team name is required");
    item.name = name;
  }
  if (req.body.members !== undefined) {
    item.members = req.body.members;
  }
  await item.save();
  res.json({ success: true, item });
});

exports.delete = asyncHandler(async (req, res) => {
  const item = await Team.findById(req.params.teamId);
  if (!item) throw new ApiError(404, "Team not found");
  await item.deleteOne();
  res.json({ success: true, message: "Team deleted" });
});

exports.linkUnit = asyncHandler(async (req, res) => {
  const item = await links.linkRecord({
    Model: Team, type: "team", label: "Team",
    company: req.params.instanceId, recordId: req.params.teamId,
    unitId: req.body.organizationUnit,
  });
  res.json({ success: true, item });
});
