const express = require('express')
const router = express.Router()
const IncentiveController = require('../controllers/IncentiveController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'incentives': ['canAccess'] } }),
    IncentiveController.index
)

router.get('/vouchers',
    requiresPermissions({ passenger: true, driver: true }),
    IncentiveController.availableVouchers
)

router.get('/my-vouchers',
    requiresPermissions({ passenger: true }),
    IncentiveController.myVouchers
)

router.post('/cashout',
    requiresPermissions({ passenger: true }),
    IncentiveController.cashoutIncentive
)
router.get('/export',
    requiresPermissions({ account: { 'incentives': ['canAccess'] } }),
    IncentiveController.exportReport
)

module.exports = router
