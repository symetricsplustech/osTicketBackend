import { describe, expect, it } from "vitest";
import { validateWorkflowDefinition } from "../../src/validators/saasadmin/workflow-management.validators";

function validDefinition() {
  return {
    initialNodeId: "start",
    nodes: [
      { id: "start", type: "START", name: "Start", next: ["check"] },
      {
        id: "check",
        type: "CONDITION",
        name: "Is it urgent?",
        next: ["urgent", "normal"],
      },
      {
        id: "urgent",
        type: "APPROVAL",
        name: "Manager approval",
        next: ["notify"],
      },
      { id: "normal", type: "ACTION", name: "Auto-assign", next: ["notify"] },
      {
        id: "notify",
        type: "NOTIFICATION",
        name: "Notify requester",
        next: ["done"],
      },
      { id: "done", type: "END", name: "Done" },
    ],
  };
}

describe("workflow definition validation", () => {
  it("accepts a complete, reachable workflow", () => {
    const result = validateWorkflowDefinition(validDefinition());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object definitions", () => {
    expect(validateWorkflowDefinition(null).valid).toBe(false);
    expect(validateWorkflowDefinition("nope").valid).toBe(false);
    expect(validateWorkflowDefinition([]).valid).toBe(false);
  });

  it("requires exactly one START node", () => {
    const definition = validDefinition();
    definition.nodes.push({
      id: "start-2",
      type: "START",
      name: "Second start",
      next: ["done"],
    } as never);
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/exactly one START/i);
  });

  it("requires at least one END node", () => {
    const definition = validDefinition();
    definition.nodes = definition.nodes.filter((node) => node.type !== "END");
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/END node/i);
  });

  it("rejects duplicate node ids", () => {
    const definition = validDefinition();
    definition.nodes.push({
      id: "check",
      type: "ACTION",
      name: "Duplicate",
      next: ["done"],
    } as never);
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/more than once/i);
  });

  it("rejects transitions to unknown nodes", () => {
    const definition = validDefinition();
    definition.nodes[0]!.next = ["ghost"];
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/unknown node/i);
  });

  it("rejects unreachable nodes", () => {
    const definition = validDefinition();
    definition.nodes.push({
      id: "orphan",
      type: "ACTION",
      name: "Orphan",
      next: ["done"],
    } as never);
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/unreachable/i);
  });

  it("rejects an initial node that is not the START node", () => {
    const definition = validDefinition();
    definition.initialNodeId = "check";
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/must be of type START/i);
  });

  it("requires non-END nodes to have outgoing transitions", () => {
    const definition = validDefinition();
    definition.nodes[1]!.next = [];
    const result = validateWorkflowDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/at least one outgoing/i);
  });
});
