const express = require('express')
const router = express.Router()
const CorporatePaymentController = require('../controllers/CorporatePaymentController')
const authRequired = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { users: ['canAccess'] } }),
    CorporatePaymentController.index
)

module.exports = router
