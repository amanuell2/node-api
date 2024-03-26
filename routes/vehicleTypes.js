const express = require('express')
const router = express.Router()
const VehicleTypeController = require('../controllers/VehicleTypeController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/', VehicleTypeController.index)

router.get('/:id', VehicleTypeController.show)

router.post('/',
    requiresPermissions({ account: { 'vehicle-type': ['canAccess'] } }),
    VehicleTypeController.store
)

router.post('/adjust-order',
    requiresPermissions({ account: { 'vehicle-type': ['canAccess'] } }),
    VehicleTypeController.adjustOrder
)

router.patch('/:id',
    requiresPermissions({ account: { 'vehicle-type': ['canAccess'] } }),
    VehicleTypeController.update
)

router.delete('/:id',
    requiresPermissions({ account: { 'vehicle-type': ['canAccess'] } }),
    VehicleTypeController.remove
)

module.exports = router
