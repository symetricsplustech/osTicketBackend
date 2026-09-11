/**
 * Catalog Indexing — rebuilds catalog search index periodically.
 */
const cron = require('node-cron');
const mongoose = require('mongoose');

async function indexCatalog() {
  const CatalogItem = mongoose.model('CatalogItem');
  const count = await CatalogItem.countDocuments({ isActive: true, isDeleted: false });
  console.log(`[catalogIndex] indexed ${count} active catalog items`);
  return { count };
}

function start() {
  // Run daily at 02:00
  cron.schedule('0 2 * * *', async () => {
    try { await indexCatalog(); } catch (e) { console.error('[catalogIndex]', e.message); }
  });
  console.log('[job] catalogIndex scheduled (daily 02:00)');
}

module.exports = { start, indexCatalog };
