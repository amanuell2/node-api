const express = require('express')
const router = express.Router()
const DriversFinanceController = require('../controllers/DriversFinanceController')

const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/', DriversFinanceController.index)

router.get('/export',
    requiresPermissions({ account: { 'drivers-finance': ['canAccess'] } }),
    DriversFinanceController.exportReport
)

module.exports = router
