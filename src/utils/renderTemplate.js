const renderTemplate = (template, data = {}) => {
  if (!template) return '';
  return template.replace(/%\{([\w.]+)\}/g, (match, key) => {
    const value = key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), data);
    return value !== undefined ? String(value) : match;
  });
};

module.exports = renderTemplate;
