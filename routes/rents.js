const express = require('express')
const router = express.Router()
const RentController = require('../controllers/RentController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'rents': ['canAccess'] } }),
    RentController.index
)

router.get('/export',
    requiresPermissions({ account: { 'rents': ['canAccess'] } }),
    RentController.exportReport
)

router.get('/:id',
    requiresPermissions({ account: { 'rents': ['canAccess'] } }),
    RentController.show
)

// router.post('/', RentController.store)

// router.patch('/:id', RentController.update)

// router.delete('/:id', RentController.remove)

module.exports = router
