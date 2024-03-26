const express = require('express');
const router = express.Router();
const MockReportController = require('../controllers/MockReportController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
    requiresPermissions({ account: { 'mock-reports': ['canAccess'] } }),
    MockReportController.index);

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN
//     ]),
//     MockReportController.exportReport
// )

module.exports = router;