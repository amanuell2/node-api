const express = require('express')
const router = express.Router()
const TripSearchController = require('../controllers/TripSearchController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
    TripSearchController.index
)

router.get('/location-data',
    requiresPermissions({ account: { 'birds-eye-view': ['canAccess'] } }),
    TripSearchController.dataForHeatMap
)

router.get('/export',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] } }),
    TripSearchController.exportReport
)

router.get('/:id',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] } }),
    TripSearchController.show
)

router.post('/',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] } }),
    TripSearchController.store
)

router.post('/:id/cancel',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
    TripSearchController.cancel
)

router.post('/:id/restart',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
    TripSearchController.restart
)

router.post('/:id/retry',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
    TripSearchController.retry
)

router.patch('/:id',
    requiresPermissions({ account: { 'trip-searches': ['canAccess'] } }),
    TripSearchController.update
)

// router.delete('/:id',
//     requiresPermissions([
//         ROLES.ADMIN,
//         ROLES.DISPATCHER
//     ]),
//     TripSearchController.remove
// )

module.exports = router
