const Agent = require('../models/Agent');
const Ticket = require('../models/Ticket');
const Department = require('../models/Department');
const { fetchTrainingSet, suggest } = require('./suggestion.service');

async function autoRoute({ company, departmentId, subject, details, priority }) {
  const trainingDocs = await fetchTrainingSet(company);
  const text = [subject, details].filter(Boolean).join('\n');
  const suggestions = suggest({ text, docs: trainingDocs });

  const topDeptId =
    suggestions.department.length && suggestions.department[0].id
      ? suggestions.department[0].id
      : null;

  const topPriority =
    suggestions.priority.length && suggestions.priority[0].name
      ? suggestions.priority[0].name
      : null;

  const targetDept = departmentId ? await Department.findById(departmentId).lean() : null;
  const teamForPriority = topPriority && targetDept?.autoAssignTeam ? String(targetDept.autoAssignTeam) : null;

  const agents = await Agent.find({
    company,
    isActive: true,
    'departments.department': departmentId,
  }).lean();

  if (!agents.length) {
    return { agentId: null, method: 'learned', confidence: 0, scores: [] };
  }

  const similarDocIds = (suggestions.similar || []).map((s) => s.id);

  const scores = [];
  for (const agent of agents) {
    let score = 0;

    // +30 if agent is in the department matching the top suggestion
    if (topDeptId && agent.departments.some((d) => String(d.department) === String(topDeptId))) {
      score += 30;
    }

    // +20 if agent has resolved similar ticket types
    if (similarDocIds.length) {
      const resolvedCount = await Ticket.countDocuments({
        company,
        agent: agent._id,
        status: { $in: ['resolved', 'closed'] },
        _id: { $in: similarDocIds },
      });
      if (resolvedCount > 0) score += 20;
    }

    // +10 if agent is in the team that handles the top priority
    if (teamForPriority && agent.teams.some((t) => String(t) === teamForPriority)) {
      score += 10;
    }

    // -20 if agent is at or above their workload cap
    const cap = agent.capacity || 20;
    const openCount = await Ticket.countDocuments({
      company,
      agent: agent._id,
      status: { $nin: ['resolved', 'closed', 'deleted'] },
    });
    if (openCount >= cap) score -= 20;

    scores.push({ agentId: agent._id, score, openCount });
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score <= 0) {
    return { agentId: null, method: 'learned', confidence: 0, scores };
  }

  const maxPossible = 60;
  const confidence = Math.round((best.score / maxPossible) * 100) / 100;
  return { agentId: best.agentId, method: 'learned', confidence, scores };
}

async function isOverloaded(agentId, company, cap = 20) {
  const openCount = await Ticket.countDocuments({
    company,
    agent: agentId,
    status: { $nin: ['resolved', 'closed', 'deleted'] },
  });
  return openCount >= cap;
}

module.exports = { autoRoute, isOverloaded };
