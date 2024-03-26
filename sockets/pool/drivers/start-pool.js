const Pool = require('../../../models/Pool')
const Trip = require('../../../models/Ride')
const {ObjectId} = require('mongoose').Types
const { sanitizeInputs } = require('../../utils/core')
const POOL_STATUS = require('../../../constants/pool-statuses')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const activityLogger = require('../../../services/activity-logger')
const { emitToPassenger } = require('../../utils/passenger')
const { updateVehicle } = require('../../utils/vehicle')

const schema = {
  type: 'object',
  properties: {
  },
  required: [],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    // await sanitizeInputs(schema, data)
    const poolToStart = await Pool.findOne({
      driver: ObjectId(driver._id),
      status: { $nin: [POOL_STATUS.CANCELLED, POOL_STATUS.ENDED] }
    }).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')

    if (!poolToStart) {
      socket.emit('error', {
        type: 'pool',
        message: 'you have not created a pool'
      })
      return
    }

    if (poolToStart.passengers.length < 2) {
      socket.emit('error', {
        type: 'pool',
        message: 'at least 2 passengers must join for the pool to start'
      })
      return
    }

    poolToStart.status = POOL_STATUS.STARTED

    // await activityLogger.logActivity(activityLogger.POOL_HAS_STARTED)({ driver: driver, vehicle: vehicle, pool: poolToStart })

    for (const passenger of poolToStart.passengers) {
      const poolTrip = await Trip.create({
        passenger: passenger._id,
        driver: driver._id,
        vehicle: poolToStart.vehicle,
        type: 'pool',
        pickUpAddress: {
          name: poolToStart.pickUpAddress.name,
          lat: poolToStart.pickUpAddress.lat,
          long: poolToStart.pickUpAddress.long
        },
        vehicleType: poolToStart.vehicleType,
        route: [],
        status: TRIP_STATUS.STARTED,
        active: true,
        pickupTimestamp: new Date(),
        createdBy: 'app'
      })
      poolToStart.trips.push(poolTrip._id)

      const startedTrip = await Trip.findById(poolTrip._id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

      emitToPassenger(passenger._id)('trip', {
        ...startedTrip._doc,
        route: poolToStart.route
      })
      // io.of('/passenger-socket').to(getUser({ userId: passenger._id }).socketId).emit('trip', {
      //     ...poolTrip,
      //     route: poolToStart.route,
      // })
    }

    await updateVehicle(vehicle._id)({ online: false,
      inActiveTrip: true,
    })

    await poolToStart.save()
    const createdPool = await Pool.findById(poolToStart._id).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')
    socket.emit('pool', createdPool)
  } catch (error) {
    console.log(error)
  }

}
