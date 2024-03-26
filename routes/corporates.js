const express = require('express')
const router = express.Router()
const CorporateController = require('../controllers/CorporateController')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/list-for-dispatcher',
  requiresPermissions({
    account: {
      'manual-trip-booking': ['canAccess'],
    }
  }),
  CorporateController.listOfCorporates
)

router.get('/list',
  requiresPermissions({
    account: {
      'corporate-reports': ['canAccess'],
    }
  }),
  CorporateController.listOfCorporates
)

router.get('/report/:id',
  requiresPermissions({
    account: {
      'corporate-reports': ['canAccess'],
    }
  }),
  CorporateController.exportCorporateTrips
)

router.get('/employees-list',
  requiresPermissions({ account: { 'manual-trip-booking': ['canAccess'] } }),
  CorporateController.listOfEmployees
)

router.use('/:corporateId/roles',
  require('./corporate-roles')
)

router.get('/',
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.index
)

router.get('/search',
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.search
)


router.get('/:id',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.show
)
router.patch('/pricing/:id',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.updatePricing
)


router.get('/:id/employees',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  // requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.employees
)

router.get('/:id/trips',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trips': ['canAccess'] } }),
  CorporateController.trips
)

router.get('/:id/scheduled-trips',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trips': ['canAccess'] } }),
  CorporateController.scheduledTrips
)

router.get('/:id/trip-searches',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
  CorporateController.tripSearches
)

router.post('/:id/trip-searches/:tripSearchId/retry',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
  CorporateController.retryTripSearch
)

router.post('/:id/trip-searches/:tripSearchId/restart',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
  CorporateController.restartTripSearch
)

router.post('/:id/trip-searches/:tripSearchId/cancel',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trip-searches': ['canAccess'] } }),
  CorporateController.cancelTripSearch
)

router.get('/:id/trip-requests',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trip-requests': ['canAccess'] } }),
  CorporateController.tripRequests
)

router.get('/:id/tickets',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  // requiresPermissions({ account: { 'corporate-management': ['canAccess'] }, corporate: { 'corporate-trip-searches' : [ 'canAccess' ]} }),
  CorporateController.tickets
)

router.post('/:id/pay',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE,
  //   ROLES.FINANCE
  // ]),
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.pay
)

router.get('/:id/dashboard',
  // authRequired([
  //   ROLES.ADMIN,
  //   ROLES.CORPORATE
  // ]),
  // requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.dashboard
)

router.post('/',
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.store
)

router.patch('/:id',
  requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
  CorporateController.update
)

// router.delete('/:id',
//   requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
//   CorporateController.remove
// )

module.exports = router
