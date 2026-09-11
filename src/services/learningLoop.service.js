const { invalidateTraining } = require('./suggestion.service');
const { bus } = require('./events');

let started = false;
function startLearningLoop() {
  if (started) return;
  started = true;
  bus.on('ticket.resolved', (payload = {}) => invalidateTraining(payload.company));
}

module.exports = { startLearningLoop };
