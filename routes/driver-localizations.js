const express = require('express')
const router = express.Router()
const LocalizationController = require('../controllers/DriverLocalizationController')

const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
  LocalizationController.index
)

router.get('/:code',
  LocalizationController.get
)


router.patch('/:id',
  requiresPermissions({ account: { 'localization': ['canAccess'] } }),
  LocalizationController.update
)

router.delete('/:id',
  requiresPermissions({ account: { 'localization': ['canAccess'] } }),
  LocalizationController.remove
)

module.exports = router