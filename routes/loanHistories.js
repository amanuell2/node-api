const express = require('express')
const router = express.Router()
const LoanController = require('../controllers/LoanController')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
  requiresPermissions({
    account: {
      'loan-history': ['canAccess']
    }
}),
  LoanController.index
)

module.exports = router
