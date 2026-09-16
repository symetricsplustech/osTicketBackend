const assert = require("node:assert/strict");
const OrganizationUnit = require("../src/models/OrganizationUnit");
const OrganizationUnitLabel = require("../src/models/OrganizationUnitLabel");
const hierarchy = require("../src/services/organizationHierarchy.service");

async function run() {
  assert.equal(hierarchy.normalizeType(" Business_Unit "), "business_unit");
  assert.equal(hierarchy.validType("business_unit"), true);
  assert.equal(hierarchy.validType("business unit"), false);
  assert.equal(OrganizationUnit.schema.path("type").options.enum, undefined);

  const findOne = OrganizationUnit.findOne;
  const exists = OrganizationUnit.exists;
  const labelExists = OrganizationUnitLabel.exists;
  try {
    const units = new Map([
      ["root", { _id: "root", parent: null }],
      ["child", { _id: "child", parent: "root" }],
    ]);
    OrganizationUnit.findOne = async ({ _id, company }) =>
      company === "tenant-a" ? units.get(String(_id)) || null : null;
    OrganizationUnitLabel.exists = async ({ company, type }) =>
      company === "tenant-a" && type === "business_unit";
    OrganizationUnit.exists = async () => false;

    assert.equal(await hierarchy.assertType("tenant-a", "Business_Unit"), "business_unit");
    await assert.rejects(hierarchy.assertType("tenant-b", "business_unit"), /Create the organization unit type/);
    await assert.rejects(hierarchy.assertParent("tenant-b", "root"), /outside this company/);
    await assert.rejects(hierarchy.assertParent("tenant-a", "child", "root"), /cycle/);
    assert.equal((await hierarchy.assertParent("tenant-a", "root"))._id, "root");
  } finally {
    OrganizationUnit.findOne = findOne;
    OrganizationUnit.exists = exists;
    OrganizationUnitLabel.exists = labelExists;
  }
  console.log("Organization hierarchy checks passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
