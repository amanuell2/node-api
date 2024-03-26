const express = require('express')
const router = express.Router()
const TripController = require('../controllers/TripController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'trips': ['canAccess'] }, corporate: { 'corporate-trips': ['canAccess'] } }),
    TripController.index
)

router.get('/latest',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.latest
)

router.get('/export',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.exportReport
)

router.get('/:id',
    requiresPermissions({ account: { 'trips': ['canAccess'] }, corporate: { 'corporate-trips': ['canAccess'] } }),
    TripController.show
)

router.get('/:id/sos',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.sos
)

router.post('/',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.store
)

router.post('/:id/cancel',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.cancel
)

router.post('/:id/end',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.end
)

router.patch('/:id',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.update
)

// router.delete('/:id',
//     requiresPermissions([
//         ROLES.ADMIN,
//         ROLES.DISPATCHER
//     ]),
//     TripController.remove
// )

router.get('/:id/send-email',
    requiresPermissions({ account: { 'trips': ['canAccess'] } }),
    TripController.resendEmail
)

module.exports = router
