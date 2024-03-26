const express = require('express')
const router = express.Router()
const TicketController = require('../controllers/TicketController')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
    requiresPermissions({ corporate: true }),
    TicketController.index
)

router.get('/:id',
    requiresPermissions({ corporate: true }),
    TicketController.show
)

router.get('/validate/:code/:phone',
    requiresPermissions({ corporate: { 'corporate-dispatcher': ['canAccess'] }, driver: true, passenger: true, account: { "manual-trip-booking": { canAccess: true } } }),
    TicketController.validate
)

router.post('/generate/:id',
    requiresPermissions({ corporate: true }),
    TicketController.generate
)

// router.patch('/:id',
// requiresPermissions([
//     ROLES.CORPORATE
// ]),
// TicketController.update)

// router.delete('/:id',TicketController.remove)

module.exports = router
