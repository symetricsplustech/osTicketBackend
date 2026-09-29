/* eslint-disable no-console */
// Real end-to-end test for the 1.1 cross-module flow
// (Incident → Problem → Known Error → Knowledge → Change → Permanent Fix)
// against the configured PostgreSQL runtime (no mocks):
//
//   1. Incident owns a CI link with role / is_active / linked_by.
//   2. Problem links the Incident and the same CI.
//   3. Problem owns numbered Problem Tasks (number / created_by / is_active).
//   4. Workaround is published and pushed back to linked Incidents.
//   5. Known Error article is created from the Problem (number / created_by).
//   6. A Change is raised and linked to the Problem.
//   7. Change implementation records remediation evidence (jsonb).
//   8. Post-incident review is created, approved and published with actor/time.
//
// All seed rows are removed afterward so the run is idempotent.
// Run: node tests/e2e-itsm-1dot1-flow.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

(async () => {
  console.log("\n=== ITSM 1.1 FLOW E2E (REAL POSTGRES) ===\n");

  const connectDB = require("../src/config/db");
  const { getDB } = require("../src/config/db");
  await connectDB();
  const db = getDB();

  const Company = require("../src/models/Company");
  const Agent = require("../src/models/Agent");
  const ConfigurationItem = require("../src/models/cmdb/ConfigurationItem");
  const IncidentService = require("../src/services/incidentService");
  const ProblemService = require("../src/services/problemService");
  const ChangeService = require("../src/services/changeService");
  const PostIncidentReviewService = require("../src/services/postIncidentReviewService");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ownerEmail = `owner-${suffix}@verify.example.com`;

  const tenantId = null;
  let company = null;
  let owner = null;
  let ci = null;
  let incident = null;
  let problem = null;
  let change = null;

  const cleanup = async () => {
    try {
      const cid = company ? String(company.id) : null;
      if (cid) {
        const incidentId = incident ? String(incident._id || incident.id) : "00000000-0000-4000-8000-000000000000";
        const problemId = problem ? String(problem._id || problem.id) : "00000000-0000-4000-8000-000000000000";
        const changeId = change ? String(change._id || change.id) : "00000000-0000-4000-8000-000000000000";
        const keIds = (await db("known_errors").where("company_id", cid).pluck("id")) || [];
        for (const t of [
          "incident_resolutions", "incident_cis", "incident_assignment_histories", "incidents",
          "problem_changes", "problem_knowledge", "problem_cis", "problem_incidents",
          "problem_tasks", "problem_assignment_histories", "problems",
          "change_implementation_results", "change_tasks", "change_cis", "change_risk_assessments", "change_requests",
          "post_incident_reviews", "root_cause_records",
        ]) {
          await db(t).where("company_id", cid).del();
        }
        for (const t of ["problem_incidents"]) {
          await db(t).where("company_id", cid).del();
        }
        if (incidentId) { await db("incident_resolutions").whereIn("incident_id", [incidentId]).del(); }
        if (incidentId) { await db("incident_cis").where("incident_id", incidentId).orWhereIn("ci_id", ci ? [String(ci.id)] : []).del(); }
        if (problemId) { await db("problem_tasks").where("problem_id", problemId).del(); }
        if (problemId) { await db("problem_cis").where("problem_id", problemId).del(); }
        if (problemId) { await db("problem_incidents").where("problem_id", problemId).del(); }
        if (problemId) { await db("problem_changes").where("problem_id", problemId).del(); }
        if (keIds.length) { await db("known_errors").whereIn("id", keIds).del(); }
        if (changeId) { await db("change_implementation_results").where("change_id", changeId).del(); }
        await db("audit_events").where("tenant_id", cid).del();
        await db("companies").where("id", cid).del();
      }
      if (ownerEmail) {
        await db("users").where("email", ownerEmail).del();
        await db("agents").where("email", ownerEmail).del();
      }
    } catch (e) {
      console.log(`cleanup note: ${e.message}`);
    }
  };

  try {
    // Seed a tenant + owner agent (instance owner).
    company = await Company.create({
      name: `E2E 1.1 ${suffix}`,
      domain: `${suffix}.verify.example.com`,
      status: "active",
    });
    const cid = String(company.id);
    owner = await Agent.create({
      name: "E2E 1.1 Owner",
      email: ownerEmail,
      password: "e2e-temp-password-123",
      is_admin: true,
      company_id: cid,
      instance_memberships: [
        {
          instance: cid,
          role: "instance_owner",
          status: "active",
          permissions: [],
        },
      ],
    });
    const ownerId = owner.id || owner._id;
    await Company.updateById(company.id, { ownerId });

    // CI that every record in the chain will reference.
    ci = await ConfigurationItem.create({
      name: `E2E Checkout Service ${suffix}`,
      tenantId: cid,
      ciClass: "service",
    });
    const ciId = String(ci.id || ci._id);

    // 1. Incident with a linked CI (role / is_active / linked_by columns).
    incident = await IncidentService.create(
      { title: `Incident for ${suffix}`, company: cid, severity: "sev2", number: `INC-${suffix}` },
      ownerId,
    );
    const incidentId = String(incident._id || incident.id);
    console.log("incident:", JSON.stringify({ number: incident.number, id: incidentId }));
    await IncidentService.linkCI(incidentId, ciId, "affected", cid, ownerId);
    const incCi = await db("incident_cis").where({ incident_id: incidentId, ci_id: ciId }).first();
    assert(incCi && incCi.role === "affected", "incident_cis role persisted");
    assert(incCi.is_active === true, "incident_cis is_active defaults true");
    assert(String(incCi.linked_by) === String(ownerId), "incident_cis linked_by persisted");

    // 2. Problem links the Incident and the same CI.
    problem = await ProblemService.create(
      { title: `Root cause of ${suffix}`, company: cid, description: "RCA", number: `PRB-${suffix}` },
      ownerId,
    );
    const problemId = String(problem._id || problem.id);
    console.log("problem:", JSON.stringify({ number: problem.number, id: problemId }));
    await ProblemService.linkIncident(problemId, incidentId, cid, ownerId);
    const pInc = await db("problem_incidents").where({ problem_id: problemId, incident_id: incidentId }).first();
    assert(pInc && pInc.is_active === true, "problem_incidents active");
    assert(String(pInc.linked_by) === String(ownerId), "problem_incidents linked_by persisted");
    await ProblemService.linkCI(problemId, ciId, "affecting", cid, ownerId);
    const pCi = await db("problem_cis").where({ problem_id: problemId, ci_id: ciId }).first();
    assert(pCi && pCi.role === "affecting", "problem_cis role persisted");
    assert(String(pCi.linked_by) === String(ownerId), "problem_cis linked_by persisted");

    // 3. Problem owns numbered Problem Tasks.
    const task = await ProblemService.createTask(
      problemId,
      { title: "Collect logs", description: "Gather checkout service logs", status: "open" },
      cid,
      ownerId,
    );
    console.log("task:", JSON.stringify({ number: task.number, id: task._id || task.id }));
    assert(/^PRT-\d{4}-\d{4}$/.test(task.number), "problem task number generated (PRT-YYYY-0001)");
    const taskRow = await db("problem_tasks").where("id", task._id || task.id).first();
    assert(String(taskRow.created_by) === String(ownerId), "problem_tasks created_by persisted");
    assert(taskRow.is_active === true, "problem_tasks is_active defaults true");

    // 4. Workaround published and pushed to linked Incidents.
    await ProblemService.update(
      problemId,
      { workaround: "Restart the checkout pod via kubectl rollout restart" },
      cid,
      ownerId,
    );
    await ProblemService.publishWorkaround(problemId, cid, ownerId);
    const updatedProblem = await ProblemService.getById(problemId, cid);
    assert(updatedProblem.workaroundPublished === true, "problem workaround published");
    const pushed = await ProblemService.pushWorkaroundToIncidents(problemId, cid, ownerId);
    console.log("pushed:", JSON.stringify(pushed));
    assert(pushed.length === 1, "workaround pushed to exactly one linked incident");
    const resolution = await db("incident_resolutions")
      .where({ incident_id: incidentId, problem_id: problemId })
      .orderBy("created_at", "desc")
      .first();
    assert(resolution && resolution.source === "problem_workaround_push", "incident resolution row from push");

    // 5. Known Error article created from the Problem.
    const ke = await ProblemService.createKnownError(
      problemId,
      { title: `Checkout pod restart outage ${suffix}`, root_cause: "Pod OOM due to cache thrash", workaround: updatedProblem.workaround },
      cid,
      ownerId,
    );
    console.log("ke:", JSON.stringify({ number: ke.number, id: ke._id || ke.id }));
    assert(/^KE-\d{4}-\d{4}$/.test(ke.number), "known error number generated (KE-YYYY-0001)");
    const keRow = await db("known_errors").where("id", ke._id || ke.id).first();
    assert(String(keRow.created_by) === String(ownerId), "known_errors created_by persisted");
    assert(keRow.is_active === true, "known_errors is_active defaults true");
    const linkedProblem = await ProblemService.getById(problemId, cid);
    assert(linkedProblem.knownError === true, "problem flagged as having a known error");

    // 6. Change raised and linked to the Problem.
    change = await ChangeService.create(
      { title: `Permanent fix for ${suffix}`, company: cid, description: "Increase checkout cache", number: `CHG-${suffix}` },
      ownerId,
    );
    const changeId = String(change._id || change.id);
    console.log("change:", JSON.stringify({ number: change.number, id: changeId }));
    await ProblemService.linkChange(problemId, changeId, "fixes", cid, ownerId);
    const pChg = await db("problem_changes").where({ problem_id: problemId, change_id: changeId }).first();
    assert(pChg && pChg.relationship_type === "fixes", "problem_changes relationship_type persisted");

    // 7. Change implementation records remediation evidence (jsonb).
    const result = await ChangeService.createImplementationResult(
      changeId,
      {
        result: "success",
        notes: "Cache bumped 256MB → 1GB; rollout green.",
        remediationEvidence: [
          { type: "deployment", reference: `chg-${suffix}` },
          { type: "check", reference: "uptime-health" },
        ],
      },
      cid,
      ownerId,
    );
    console.log("result:", JSON.stringify({ id: result._id || result.id, evidence: result.remediation_evidence || result.remediationEvidence }));
    const resultRow = await db("change_implementation_results").where("change_id", changeId).first();
    const evidence = typeof resultRow.remediation_evidence === "string"
      ? JSON.parse(resultRow.remediation_evidence)
      : resultRow.remediation_evidence;
    assert(evidence && evidence.length === 2, "remediation_evidence array persisted");
    assert(String(resultRow.implemented_by) === String(ownerId), "implemented_by persisted");
    const fetchedResult = await ChangeService.getImplementationResult(changeId, cid);
    assert(fetchedResult != null, "getImplementationResult retrieves saved result");
    assert(
      Array.isArray(fetchedResult.remediation_evidence) && fetchedResult.remediation_evidence.length === 2,
      "retrieved result carries remediation evidence",
    );

    // 8. Post-incident review created, approved and published.
    const pir = await PostIncidentReviewService.create(
      { incident: incidentId, findings: ["Cache thrash caused OOM loop"], action_items: ["Raise cache headroom"] },
      cid,
      ownerId,
    );
    const pirId = String(pir._id || pir.id);
    const pirRow0 = await db("post_incident_reviews").where("id", pirId).first();
    assert(String(pirRow0.created_by) === String(ownerId), "post_incident_reviews created_by persisted");
    await PostIncidentReviewService.submitForReview(pirId, cid, ownerId);
    await PostIncidentReviewService.approve(pirId, cid, ownerId);
    const pirRow1 = await db("post_incident_reviews").where("id", pirId).first();
    assert(pirRow1.status === "approved", "PIR status approved");
    assert(String(pirRow1.approved_by) === String(ownerId), "PIR approved_by persisted");
    assert(pirRow1.approved_at != null, "PIR approved_at persisted");
    await PostIncidentReviewService.publish(pirId, cid, ownerId);
    const pirRow2 = await db("post_incident_reviews").where("id", pirId).first();
    assert(pirRow2.status === "published", "PIR status published");
    assert(pirRow2.published_at != null, "PIR published_at persisted");

    console.log("\n🎉 ITSM 1.1 FLOW E2E VERIFIED (LIVE POSTGRES)\n");
  } finally {
    await cleanup();
    if (db) await db.destroy();
  }
})().catch(async (err) => {
  console.error(err.message);
  try {
    const { getDB } = require("../src/config/db");
    const db = getDB();
    await db.destroy();
  } catch (_) {}
  process.exit(1);
});