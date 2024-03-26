const express = require('express')
const router = express.Router()
const LogController = require('../controllers/LogController')
const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
  requiresPermissions({
    account : { 'logs': ['canAccess'] }
}),
  LogController.index
)

module.exports = router
