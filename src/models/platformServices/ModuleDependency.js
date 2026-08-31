const mongoose = require('mongoose');
const moduleDependencySchema = new mongoose.Schema({
  moduleKey: { type: String, required: true, unique: true },
  dependsOn: [String],
  incompatibleWith: [String],
});
module.exports = mongoose.models.ModuleDependency || mongoose.model('ModuleDependency', moduleDependencySchema);
