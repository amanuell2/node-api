const express = require('express')
const router = express.Router()
const accountController = require('../controllers/AccountController')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const requiresAuthentication = require('../middleware/adminAuthMiddleware')
const activityLogger = require('../services/activity-logger')
const url = require('url')

router.get('/search', accountController.search)

router.get('/',
  requiresPermissions({ account: { users: ['canAccess'] } }),
  accountController.index
)

router.get('/:id',
  requiresPermissions({ account: { users: ['canAccess'] } }),
  accountController.show
)
router.post('/auth', accountController.auth)

router.post('/set-role',
  requiresAuthentication(),
  accountController.setRole
)

router.post('/set-corporate-role',
  requiresAuthentication(),
  accountController.setCorporateRole
)

router.get('/role',
  requiresAuthentication(),
  accountController.getRole
)

router.post('/:id/reset-password',
  requiresPermissions({ account: { users: ['canAccess'] } }),
  accountController.resetPassword
)

router.get('/check/:token', accountController.check)

router.patch('/:id',
  requiresPermissions({ account: { users: ['canAccess'] } }),
  accountController.update
)
router.post('/',
  requiresPermissions({ account: { users: ['canAccess'] } }),
  async (req, res, next) => {
    await activityLogger.ADMIN_HAS_CREATED_RESOURCE({ account: res.locals.user, url: req.originalUrl, path: url.parse(req.originalUrl).pathname })
    next()
  },
  accountController.store
)

module.exports = router
