const express = require('express');
const router = express.Router();
const ActivityLogController = require('../controllers/ActivityLogController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'activity-logs': ['canAccess'] } }),
    ActivityLogController.index
);

router.get('/types',
    requiresPermissions({ account: { 'activity-logs': ['canAccess'] } }),
    ActivityLogController.activityTypes
);

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//     ]),
//     ActivityLogController.exportReport
// )

module.exports = router;