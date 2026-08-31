module.exports = {
  ...require('./auth'),
  ...require('./dashboard'),
  ...require('./plans'),
  ...require('./companies'),
  ...require('./subscriptions_payments'),
  ...require('./impersonation'),
  ...require('./super_admin_management'),
  ...require('./global_settings'),
  ...require('./notifications'),
};
