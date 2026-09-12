/* eslint-disable no-console */
// Task API integration test (requires DB). Run: npm run test:task-api
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const Task = require("../src/models/core/Task");
const TaskActivity = require("../src/models/core/TaskActivity");
const TaskWatcher = require("../src/models/core/TaskWatcher");
const TaskRelationship = require("../src/models/core/TaskRelationship");
const User = require("../src/models/User");
const Company = require("../src/models/Company");
const Counter = require("../src/models/Counter");

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

let token, tenantId, userId, taskId;

async function setup() {
  // Create tenant
  const company = await Company.create({
    name: "Test Tenant",
    domain: "test-task-engine.example.com",
  });
  tenantId = company._id;

  // Create user
  const user = await User.create({
    name: "Task Test User",
    email: `tasktest-${Date.now()}@example.com`,
    password: "password123",
    company: tenantId,
    role: "admin",
  });
  userId = user._id;

  // Reset counter
  await Counter.deleteOne({ _id: `${tenantId}:TASK` });

  // Login
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: user.email, password: "password123" });
  token = loginRes.body.token;
}

async function cleanup() {
  await Task.deleteMany({ tenantId });
  await TaskActivity.deleteMany({ tenantId });
  await TaskWatcher.deleteMany({ tenantId });
  await TaskRelationship.deleteMany({ tenantId });
  await User.deleteMany({ email: { $regex: "tasktest-" } });
  await Company.deleteMany({ domain: "test-task-engine.example.com" });
  await Counter.deleteOne({ _id: `${tenantId}:TASK` });
}

async function testCreateTask() {
  const res = await request(app)
    .post("/api/core/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Test Task",
      description: "A test task description",
      type: "task",
      priority: "high",
      category: "testing",
    });
  assert(res.status === 201, "create task returns 201");
  assert(res.body.number.startsWith("TASK-"), "task number generated");
  assert(res.body.state === "new", "task starts in new state");
  assert(res.body.title === "Test Task", "task title matches");
  taskId = res.body._id;
}

async function testGetTask() {
  const res = await request(app)
    .get(`/api/core/tasks/${taskId}`)
    .set("Authorization", `Bearer ${token}`);
  assert(res.status === 200, "get task returns 200");
  assert(res.body.number === "TASK-000001", "task number correct");
  assert(Array.isArray(res.body.watchers), "watchers array present");
  assert(res.body.relationships, "relationships present");
}

async function testListTasks() {
  const res = await request(app)
    .get("/api/core/tasks")
    .set("Authorization", `Bearer ${token}`);
  assert(res.status === 200, "list tasks returns 200");
  assert(res.body.tasks.length >= 1, "tasks array has items");
  assert(res.body.total >= 1, "total count correct");
}

async function testTransitionTask() {
  // new -> open
  let res = await request(app)
    .post(`/api/core/tasks/${taskId}/transition`)
    .set("Authorization", `Bearer ${token}`)
    .send({ state: "open", comment: "Opening task" });
  assert(res.status === 200, "transition new->open returns 200");
  assert(res.body.state === "open", "state is now open");

  // open -> in_progress
  res = await request(app)
    .post(`/api/core/tasks/${taskId}/transition`)
    .set("Authorization", `Bearer ${token}`)
    .send({ state: "in_progress" });
  assert(res.status === 200, "transition open->in_progress returns 200");
  assert(res.body.state === "in_progress", "state is now in_progress");

  // in_progress -> resolved
  res = await request(app)
    .post(`/api/core/tasks/${taskId}/transition`)
    .set("Authorization", `Bearer ${token}`)
    .send({ state: "resolved" });
  assert(res.status === 200, "transition in_progress->resolved returns 200");
  assert(res.body.state === "resolved", "state is now resolved");
  assert(res.body.resolvedAt !== null, "resolvedAt is set");
}

async function testInvalidTransition() {
  // resolved -> cancelled should fail
  const res = await request(app)
    .post(`/api/core/tasks/${taskId}/transition`)
    .set("Authorization", `Bearer ${token}`)
    .send({ state: "cancelled" });
  assert(res.status === 422, "invalid transition returns 422");
}

async function testAddComment() {
  const res = await request(app)
    .post(`/api/core/tasks/${taskId}/comment`)
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "This is a test comment", isPublic: true });
  assert(res.status === 201, "add comment returns 201");
  assert(res.body.type === "comment", "activity type is comment");
  assert(
    res.body.content === "This is a test comment",
    "comment content matches",
  );
}

async function testGetAllowedTransitions() {
  const res = await request(app)
    .get(`/api/core/tasks/${taskId}/transitions`)
    .set("Authorization", `Bearer ${token}`);
  assert(res.status === 200, "get transitions returns 200");
  assert(res.body.from === "resolved", "from state is resolved");
  assert(Array.isArray(res.body.allowed), "allowed is array");
  assert(
    res.body.allowed.includes("closed"),
    "resolved can transition to closed",
  );
}

async function testStats() {
  const res = await request(app)
    .get("/api/core/tasks/stats")
    .set("Authorization", `Bearer ${token}`);
  assert(res.status === 200, "stats returns 200");
  assert(Array.isArray(res.body.byState), "byState is array");
  assert(Array.isArray(res.body.byType), "byType is array");
  assert(Array.isArray(res.body.byPriority), "byPriority is array");
}

async function testUpdateTask() {
  const res = await request(app)
    .put(`/api/core/tasks/${taskId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Updated Task Title", priority: "critical" });
  assert(res.status === 200, "update task returns 200");
  assert(res.body.title === "Updated Task Title", "title updated");
  assert(res.body.priority === "critical", "priority updated");
}

(async () => {
  try {
    await setup();
    await testCreateTask();
    await testGetTask();
    await testListTasks();
    await testTransitionTask();
    await testInvalidTransition();
    await testAddComment();
    await testGetAllowedTransitions();
    await testStats();
    await testUpdateTask();
    console.log("\nAll Task API tests passed!");
  } catch (err) {
    console.error("Test failed:", err.message);
    process.exit(1);
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
})();
