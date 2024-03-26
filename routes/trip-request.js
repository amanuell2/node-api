const express = require('express')
const router = express.Router()
const TripRequestController = require('../controllers/TripRequestController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'trip-requests': ['canAccess'] }, corporate: { 'corporate-trip-requests': ['canAccess'] } }),
    TripRequestController.index
)

router.get('/export',
    requiresPermissions({ account: { 'trip-requests': ['canAccess'] } }),
    TripRequestController.exportReport
)

router.get('/:id',
    requiresPermissions({ account: { 'trip-requests': ['canAccess'] } }),
    TripRequestController.show
)

router.post('/',
    requiresPermissions({ account: { 'trip-requests': ['canAccess'] } }),
    TripRequestController.store
)

router.post('/:id/cancel',
    requiresPermissions({ account: { 'trip-requests': ['canAccess'] }, corporate: { 'corporate-trip-requests': ['canAccess'] } }),
    TripRequestController.cancel
)

router.patch('/:id',
    requiresPermissions({ account: { 'trip-requests': ['canAccess'] } }),
    TripRequestController.update
)

// router.delete('/:id',
//     requiresPermissions([
//         ROLES.ADMIN,
//         ROLES.DISPATCHER,
//     ]),
//     TripRequestController.remove
// )

module.exports = router
