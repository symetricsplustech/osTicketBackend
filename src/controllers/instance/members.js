const User = require("../../models/User");
const { assertActiveUnit } = require("../../services/instancePlacement.service");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const { runWithTenant } = require("../../middleware/tenantScope");

const membershipFor = (user, instanceId) =>
  (user.instanceMemberships || []).find((item) => String(item.instance) === instanceId);

exports.list = asyncHandler(async (req, res) => {
  const users = await runWithTenant(null, async () => User.find({ "instanceMemberships.instance": req.params.instanceId })
    .select("id name email instanceMemberships").lean());
  const items = users.map((user) => {
    const membership = membershipFor(user, req.params.instanceId);
    return {
      _id: user._id, name: user.name, email: user.email,
      role: membership.role, status: membership.status,
      organizationUnit: membership.organizationUnit || null,
    };
  });
  res.json({ success: true, items });
});

exports.place = asyncHandler(async (req, res) => {
  const { instanceId, userId } = req.params;
  const unitId = req.body.organizationUnit || null;
  await assertActiveUnit(instanceId, unitId);
  await runWithTenant(null, async () => {
    const user = await User.findOne({ _id: userId, "instanceMemberships.instance": instanceId });
    if (!user) throw new ApiError(404, "Instance member not found");
    membershipFor(user, instanceId).organizationUnit = unitId;
    await user.save();
  });
  res.json({ success: true, organizationUnit: unitId });
});
