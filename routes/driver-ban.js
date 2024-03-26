const express = require('express');
const router = express.Router();
const DriverBanController = require('../controllers/DriverBanController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/', DriverBanController.index);

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//         ROLES.DISPATCHER,
//     ]),
//     DeviceBanController.exportReport
// )

// router.get('/:id', DeviceBanController.show);

router.post('/ban-driver',
    requiresPermissions({ account: { 'banned-drivers': ['canAccess'] } }),
    DriverBanController.banDriver
);

router.patch('/:id',
    requiresPermissions({ account: { 'banned-drivers': ['canAccess'] } }),
    DriverBanController.update
);

router.delete('/:id',
    requiresPermissions({ account: { 'banned-drivers': ['canAccess'] } }),
    DriverBanController.remove
);

module.exports = router;