const express = require('express')
const router = express.Router()
const SettingController = require('../controllers/SettingController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
  requiresPermissions({
    account: {
      'site-setting': ['canAccess']
    }
  }),
  SettingController.get
)

router.post('/',
  requiresPermissions({
    account: {
      'site-setting': ['canAccess']
    }
  }),
  SettingController.add
)

module.exports = router
