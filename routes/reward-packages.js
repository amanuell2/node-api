const express = require('express');
const router = express.Router();
const RewardPackageController = require('../controllers/RewardPackageController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
    RewardPackageController.index);

router.get('/:id',
    RewardPackageController.show)

router.post('/',
    requiresPermissions({ account: { 'reward-packages': ['canAccess'] } }), RewardPackageController.store)

router.patch('/:id',
    requiresPermissions({ account: { 'reward-packages': ['canAccess'] } }), RewardPackageController.update)

router.delete('/:id',
    requiresPermissions({ account: { 'reward-packages': ['canAccess'] } }), RewardPackageController.deletePackage)

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//     ]),
//     RewardPackageController.exportReport
// )

module.exports = router;