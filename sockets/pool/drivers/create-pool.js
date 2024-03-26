const Pool = require('../../../models/Pool')
const Vehicle = require('../../../models/Vehicle')
// const { default: Axios } = require('axios')
const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const { makeRequest } = require('../../../services/axios')
const activityLogger = require('../../../services/activity-logger')
const POOL_STATUS = require('../../../constants/pool-statuses')
const { updateVehicle } = require('../../utils/vehicle')

const schema = {
  type: "object",
  properties: {
    pickUpAddress: { type: "object" },
    dropOffAddress: { type: "object" },
  },
  required: ["pickUpAddress", "dropOffAddress"],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    console.log('[DEBUG] creating a pool by driver')
    await sanitizeInputs(schema, data)


    const setting = await Setting.findOne()


    const existingPool = await Pool.findOne({ driver: driver._id, status: { $nin: [POOL_STATUS.CANCELLED, POOL_STATUS.ENDED] } })

    if (existingPool) {
      socket.emit('error', {
        type: 'pool',
        message: 'you already are in an active pool'
      })
      return
    }

    const pickup = !data.pickUpAddress.name ? makeRequest({method: 'get', url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + data.pickUpAddress.lat + ',' + data.pickUpAddress.long + '&key=' + setting.mapKey }) : data.pickUpAddress
    const dropOff = !data.dropOffAddress.name ? makeRequest({method: 'get', url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + data.dropOffAddress.lat + ',' + data.dropOffAddress.long + '&key=' + setting.mapKey }) : data.dropOffAddress

    const route = makeRequest({ method: 'get', url: 'https://api.mapbox.com/directions/v5/mapbox/driving/' + data.pickUpAddress.long + ',' + data.pickUpAddress.lat + ';' + data.dropOffAddress.long + ',' + data.dropOffAddress.lat + '?radiuses=unlimited;&geometries=geojson&access_token=pk.eyJ1IjoiYWplYnVzaGlsaWZ0IiwiYSI6ImNsY2lyMHBjODBidzUzb210ajFpZDhoZnUifQ.0vl0bDeP9tIpf5vmo49asw' })

    try {
      const [pickupRes, dropOffRes, routeRes] = await Promise.all([pickup, dropOff, route])

      if (!data.pickUpAddress.name) {
        if (pickupRes.status == 200 && pickupRes.data.status == 'OK') {
          data.pickUpAddress.name = pickupRes.data.results[0].formatted_address
        } else {
          data.pickUpAddress.name = '_'
        }
      }

      if (!data.dropOffAddress.name) {
        if (dropOffRes.status == 200 && dropOffRes.data.status == 'OK') {
          data.dropOffAddress.name = dropOffRes.data.results[0].formatted_address
        } else {
          data.dropOffAddress.name = '_'
        }
      }

      if (routeRes && routeRes.data && routeRes.data.routes && routeRes.data.routes[0] && routeRes.data.routes[0].geometry && routeRes.data.routes[0].geometry.coordinates) {
        data.route = { coordinates: routeRes.data.routes[0].geometry.coordinates, distance: routeRes.data.routes[0].distance, duration: routeRes.data.routes[0].duration }
      }
    } catch (error) {
      console.log(error)
    }

    try {
      const vehicle = await Vehicle.findOne({ driver: driver._id }).populate('vehicleType')

      if (!vehicle) {
        socket.emit('error', {
          type: 'pool',
          message: 'Driver doesn\'t have any vehicle registered'
        })
        return
      }

      if (data.size > vehicle.vehicleType.numberOfSeats) {
        socket.emit('error', {
          type: 'pool',
          message: `specified pool size (${data.size}) exceeds vehicle type's total number of seats`
        })
        return
      }

      const pool = await Pool.create({
        pickUpAddress: data.pickUpAddress,
        dropOffAddress: data.dropOffAddress,
        vehicle: vehicle._id,
        vehicleType: vehicle.vehicleType._id,
        route: data.route,
        driver: driver._id,
        size: data.size ? data.size : vehicle.vehicleType.numberOfSeats,
        position: {
          type: 'Point',
          coordinates: [data.pickUpAddress.long, data.pickUpAddress.lat]
        }
      })

      // await activityLogger.logActivity(activityLogger.POOL_HAS_BEEN_CREATED)({ driver: driver, vehicle: vehicle, pool: pool })

      await updateVehicle(vehicle._id)({ online: false,
        // poolId: pool._id
      })

      const newlyCreatedPool = await Pool.findById(pool._id).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')
      socket.emit('pool', newlyCreatedPool)
    } catch (error) {
      console.log(error)
      socket.emit('error', {
        type: 'pool',
        message: 'error while creating your pool'
      })
    }
  } catch (error) {
    console.log(error)
  }
}
