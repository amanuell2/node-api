const express = require('express');
const router = express.Router();
const RewardsController = require('../controllers/RewardController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
    requiresPermissions({ account: { 'reward-history': ['canAccess'] } }),
    RewardsController.index);

router.get('/my-rewards',
    requiresPermissions({ passenger: true }),
    RewardsController.myRewards);

router.post('/claim-reward',
    requiresPermissions({ passenger: true }),
    RewardsController.claimReward
);

router.post('/:id/change-status',
    requiresPermissions({ account: { 'reward-history': ['canAccess'] } }),
    RewardsController.changeStatus
);

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//     ]),
//     RewardsController.exportReport
// )

module.exports = router;