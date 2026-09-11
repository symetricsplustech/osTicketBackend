const router = require('express').Router();
const { protectTenantPrincipal } = require('../middleware/auth');
const { search } = require('../controllers/search.controller');

router.get('/', protectTenantPrincipal, search);

module.exports = router;
