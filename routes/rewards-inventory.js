const express = require('express');
const router = express.Router();
const RewardsInventoryController = require('../controllers/RewardsInventoryController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
    RewardsInventoryController.index);

router.get('/:id',

    requiresPermissions({ account: { 'reward-inventory': ['canAccess'] } }), RewardsInventoryController.show)

router.post('/',

    requiresPermissions({ account: { 'reward-inventory': ['canAccess'] } }), RewardsInventoryController.store)

router.patch('/:id',

    requiresPermissions({ account: { 'reward-inventory': ['canAccess'] } }), RewardsInventoryController.update)

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//     ]),
//     RewardsInventoryController.exportReport
// )

module.exports = router;