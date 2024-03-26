const express = require('express')
const router = express.Router()
const UserController = require('../controllers/UserController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'users': ['canAccess'] } }),
    UserController.index)

router.get('/admin-search',
    requiresPermissions({ account: { 'users': ['canAccess'] } }),
    UserController.adminSearch
)

router.get('/auth/:phone', UserController.oldAuth)

router.post('/auth', UserController.auth)

router.get('/search', UserController.search)

router.get('/export', requiresPermissions({ account: { 'users': ['canAccess'] } }), UserController.exportReport)

router.get('/:id', UserController.show)

router.post('/:id/rate', UserController.rate)

router.get('/:id/rents',
    requiresPermissions({ passenger: true }),

    UserController.rents
)

router.get('/:id/bookings',
    requiresPermissions({ passenger: true }),

    UserController.bookings
)

router.get('/:id/scheduled-trips',
    requiresPermissions({ passenger: true }),

    UserController.scheduledTrips
)

router.post('/',
    // requiresPermissions([
    //     ROLES.ADMIN,
    //     ROLES.DISPATCHER,
    //     ROLES.OPERATION
    // ]),
    UserController.store
)

router.patch('/:id',
    requiresPermissions({ account: { 'users': ['canAccess'] }, passenger: true }),
    UserController.update
)



// router.delete('/:id',
//     requiresPermissions([
//         ROLES.ADMIN,
//         ROLES.DISPATCHER
//     ]),
//     UserController.remove
// )

module.exports = router
