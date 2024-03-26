const express = require('express')
const router = express.Router()
const DriverController = require('../controllers/DriverController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/', DriverController.index)

router.get('/auth/:phone', DriverController.oldAuth)

router.post('/auth/', DriverController.auth)

router.get('/search', DriverController.search)

router.get('/admin-search',
    requiresPermissions({ account: { 'drivers': ['canAccess'] } }),
    DriverController.adminSearch
)

router.get('/export',
    requiresPermissions({ account: { 'drivers': ['canAccess'] } }),
    DriverController.exportReport
)


router.get('/my-vouchers',
    requiresPermissions({ driver: true }),

    DriverController.myVouchers
)

router.post('/buy-airtime',
    requiresPermissions({ driver: true }),

    DriverController.buyAirTime
)

router.get('/stats/:id', DriverController.stats)

router.get('/:id/bookings', DriverController.bookings)

router.get('/:id/income',
requiresPermissions({ driver: true }),

DriverController.income
)

router.get('/:id', DriverController.show)
router.get('/:id/wallet-history', DriverController.walletHistory)


router.get('/:id/scheduled-trips',
    requiresPermissions({ driver: true }),

    DriverController.scheduledTrips
)

router.post('/:id/rate', DriverController.rate)

router.post('/:id/top-up',
    requiresPermissions({ account: { 'drivers': ['canAccess'] } }),
    DriverController.topUp
)

router.post('/:id/wallet-transfer',
    // requiresPermissions([
    //     ROLES.DRIVER
    // ]),
    requiresPermissions({ driver: true }),
    DriverController.walletTransfer
)

router.post('/:id/wallet-lend',
    // requiresPermissions([
    //     ROLES.DRIVER
    // ]),
    requiresPermissions({ driver: true }),
    DriverController.lend
)

router.get('/:id/rents',
    requiresPermissions({ driver: true }),

    DriverController.rents
)

router.post('/',
requiresPermissions({ hasFirebaseToken: true, account: { 'drivers': ['canAccess'] } }),
    // requiresPermissions([
    //     ROLES.ADMIN,
    //     ROLES.DISPATCHER
    // ]),
    DriverController.store
)

router.patch('/:id',
    // requiresPermissions([
    //     ROLES.ADMIN,
    //     ROLES.DISPATCHER
    // ]),
requiresPermissions({ driver: true, account: { 'drivers': ['canAccess'] } }),

    DriverController.update
)

// router.delete('/:id',
//     requiresPermissions([
//         ROLES.ADMIN,
//         ROLES.DISPATCHER,
//         ROLES.OPERATION,
//     ]),
//     DriverController.remove
// )

module.exports = router
