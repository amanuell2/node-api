const express = require('express')
const router = express.Router()
const CoreController = require('../controllers/CoreController')
const { sendNotificationById } = require('../services/notificationService')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/getSettingsAndVehicleModels', CoreController.getSettingsAndVehicleModels)

router.get('/getPassengerSettings', CoreController.getPassengerSettings)
router.get('/getPassengerVehicleModels', CoreController.getPassengerVehicleModels)

router.get('/dashboard',
  requiresPermissions({ account: { 'dashboard': ['canAccess'] } }),
  CoreController.dashboard
)

router.get('/godview',
  requiresPermissions({ account: { 'birds-eye-view': ['canAccess'] } }),
  CoreController.godview
)

router.get('/date',
  // requiresPermissions([
  //     ROLES.ADMIN,
  //     ROLES.DISPATCHER
  // ]),
  CoreController.date
)

router.post('/localization-languages', CoreController.createLocalization)
router.get('/localization-languages', CoreController.localizationLanguages)

router.get('/finance/export',
  requiresPermissions({ account: { 'dashboard': ['canAccess'] } }),
  CoreController.exportFinancialReport
)

router.get('/finance',
  requiresPermissions({ account: { 'dashboard': ['canAccess'] } }),
  CoreController.finance
)

router.post('/route', CoreController.route)

router.get('/notification', (req, res) => {
  // sendNotificationById('d_M4wZKnaNY:APA91bH3uC9hbHVlTvYLZYlbn2ZTIaeM1pBExOd6ZDOgAcCNzR5gBiDT-7wbovWXGQxUiUm1uXuzlcSMBY9VUAslK3aFP-Ow4jjF1ab0F94mSUepI-3BCQeNhWueCIh5U_GGHtSlBJ8e', { title: 'test title', body: 'test body' })
  res.send('done')
})

module.exports = router
