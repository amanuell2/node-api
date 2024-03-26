const express = require('express');
const router = express.Router();
const PromoController = require('../controllers/PromoController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
    requiresPermissions({ account: { 'promo-history': ['canAccess'] } }),
    PromoController.index);

router.get('/my-invitations',
    requiresPermissions({ driver: true, passenger: true }),
    PromoController.myInvitations);

router.post('/invite',
    requiresPermissions({ driver: true, passenger: true }),
    PromoController.invite
);

// router.post('/enter-promo',
//     PromoController.enterPromo
// );

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//     ]),
//     PromoController.exportReport
// )

module.exports = router;