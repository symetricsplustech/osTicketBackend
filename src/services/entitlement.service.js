const Contract = require('../models/Contract');
const Entitlement = require('../models/Entitlement');
const User = require('../models/User');

/**
 * Evaluate whether a user/organization is entitled to create a ticket
 * for a given service (help topic or category).
 * Returns: { status: covered|not_covered|pending_approval|waived|unknown, contract, entitlement, slaOverride }
 */
async function evaluateEntitlement({ company, user, service = '', serviceType = 'any', helpTopicId = null }) {
  const result = { status: 'unknown', contract: null, entitlement: null, slaOverride: null, reason: '' };
  if (!user) return result;

  let orgId = user.organization || null;
  let tier = user.tier || 'standard';

  if (!orgId) {
    // try to infer org from company default? no — leave uncovered unless contract-less
    result.status = 'unknown';
    result.reason = 'No organization attached';
    return result;
  }

  const contract = await Contract.findOne({ company, organization: orgId, status: 'active' }).populate('slaPlans').lean();
  if (!contract) {
    const Organization = require('../models/Organization');
    const org = await Organization.findById(orgId).lean();
    result.status = org?.tier === 'enterprise' ? 'covered' : 'unknown';
    result.reason = 'No active contract';
    return result;
  }
  result.contract = contract;

  const entitlements = await Entitlement.find({ company, contract: contract._id, isActive: true }).lean();

  // service-level match
  let ent = null;
  if (helpTopicId) {
    const HelpTopic = require('../models/HelpTopic');
    const topic = await HelpTopic.findById(helpTopicId).lean();
    if (topic) {
      ent = entitlements.find((e) => e.service === 'help_topic:' + String(topic._id)) ||
        entitlements.find((e) => e.service === 'any') ||
        entitlements.find((e) => e.service === topic.category) ||
        entitlements.find((e) => e.service === topic.topic);
    }
  }
  if (!ent) ent = entitlements.find((e) => e.serviceType === 'any' || e.service === service || e.service === 'help_topic:' + helpTopicId);

  if (ent) {
    result.entitlement = ent;
    if (ent.scope === 'blocked') {
      result.status = 'not_covered';
      result.reason = 'Service not included in your support contract';
      return result;
    }
    if (ent.scope === 'paid') {
      result.status = 'not_covered';
      result.reason = 'This service requires paid support';
      return result;
    }
    if (ent.scope === 'approval') {
      result.status = 'pending_approval';
      result.reason = 'Requires approval';
      if (ent.limitType === 'count' && ent.usedCount >= ent.limitValue) {
        result.status = 'not_covered';
        result.reason = 'Included count exhausted';
      }
      return result;
    }
    if (ent.limitType === 'count' && ent.usedCount >= ent.limitValue) {
      result.status = 'not_covered';
      result.reason = 'Included tickets exhausted';
      return result;
    }
    if (ent.slaOverride) result.slaOverride = ent.slaOverride;
    result.status = 'covered';
    return result;
  }

  // default: covered if contract exists and not paid-only
  result.status = contract.support24x7 || contract.includedTicketsPerMonth > 0 ? 'covered' : 'unknown';
  return result;
}

/**
 * Record usage of an entitlement after a ticket is created.
 */
async function consumeEntitlement({ company, contractId, orgId, helpTopicId }) {
  try {
    const ents = await Entitlement.find({ company, contract: contractId, organization: orgId, isActive: true });
    for (const e of ents) {
      if (e.limitType === 'count') {
        await Entitlement.updateOne({ _id: e._id }, { $inc: { usedCount: 1 } });
      }
    }
    if (contractId) {
      await Contract.updateOne(
        { _id: contractId, 'entitlements.type': 'included' },
        { $inc: { 'entitlements.$.usedCount': 1 } }
      );
    }
  } catch (err) {
    // ignore
  }
}

module.exports = { evaluateEntitlement, consumeEntitlement };