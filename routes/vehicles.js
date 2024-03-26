const express = require('express')
const router = express.Router()
const VehicleController = require('../controllers/VehicleController')
const { getNearbyDrivers } = require('../sockets/core')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
  requiresPermissions({
    account: {
      'vehicles': ['canAccess']
    }
  }),
  VehicleController.index
)

router.get('/activeVehicles',
  requiresPermissions({
    account: {
      'vehicles': ['canAccess']
    }
  }),
  VehicleController.activeVehicles
)

router.get('/search',
  requiresPermissions({
    account: {
      'vehicles': ['canAccess']
    }
  }),
  VehicleController.search
)

router.get('/drivers', async (req, res) => {
  try {
    const drivers = await getNearbyDrivers({ location: { lat: 8.9996048, long: 38.78399910000002 }, distance: 1000000 })
    res.send(drivers)
  } catch (error) {
    console.log(error)
    res.status(500).send(error)
  }
})

router.get('/is-taken',
  requiresPermissions({ account: { 'vehicles': ['canAccess'] } }),
  VehicleController.isTaken
);

router.get('/:id', VehicleController.show)

router.post('/',
  requiresPermissions({
    account: {
      'vehicles': ['canAccess']
    }
  }),
  VehicleController.store
)

router.patch('/:id',
  requiresPermissions({
    account: {
      'vehicles': ['canAccess']
    }
  }),
  VehicleController.update
)

// router.delete('/:id',
//   requiresPermissions({
//     account: {
//       'vehicles': ['canAccess']
//     }
//   }),
//   VehicleController.remove
// )

module.exports = router
