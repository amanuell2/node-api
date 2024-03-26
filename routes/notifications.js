const express = require('express')
const router = express.Router()
const NotificationController = require('../controllers/NotificationController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.post('/topic/:topic',
  requiresPermissions({
    account: {
      'push-notification': ['canAccess']
    }
  }),
  NotificationController.sendByTopic
)

router.post('/user/:token', NotificationController.sendByToken)

router.get('/',
  // requiresPermissions([
  //   ROLES.ADMIN,
  //   ROLES.OPERATION,
  //   ROLES.DRIVER,
  //   ROLES.PASSENGER
  // ]),
  requiresPermissions({
    account: {
      'push-notification': ['canAccess']
    },
    passenger: true,
    driver: true,
  }),
  NotificationController.index
)

router.get('/search',
  requiresPermissions({
    account: {
      'push-notification': ['canAccess']
    }
  }),
  NotificationController.search
)

module.exports = router
