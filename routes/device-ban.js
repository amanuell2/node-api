const express = require('express');
const router = express.Router();
const DeviceBanController = require('../controllers/DeviceBanController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/', DeviceBanController.index);

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//         ROLES.DISPATCHER,
//     ]),
//     DeviceBanController.exportReport
// )

// router.get('/:id', DeviceBanController.show);

router.post('/ban-model',
    requiresPermissions({ account: { 'device-bans': ['canAccess'] } }),
    DeviceBanController.banModel
);

router.post('/ban-device',
    requiresPermissions({ account: { 'device-bans': ['canAccess'] } }),
    DeviceBanController.banDevice
);

router.patch('/:id',
    requiresPermissions({ account: { 'device-bans': ['canAccess'] } }),
    DeviceBanController.update
);

router.delete('/:id',
    requiresPermissions({ account: { 'device-bans': ['canAccess'] } }),
    DeviceBanController.remove
);

module.exports = router;