const { updateWallet } = require('../../../controllers/DriverController')
const Trip = require('../../../models/Ride')
const Vehicle = require('../../../models/Vehicle')
const { notifyDriver, emitToDriver } = require('../../utils/driver')
const { notifyPassenger, emitToPassenger, updatePassenger } = require('../../utils/passenger')
const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const TRIP_TYPES = require('../../../constants/trip-types')
const Pool = require('../../../models/Pool')
const POOL_STATUS = require('../../../constants/pool-statuses')

const {ObjectId} = require('mongoose').Types;
const { updatePool } = require('../../utils/pool')

const schema = {
  type: 'object',
  properties: {
    poolId: { type: 'string'},
    tripId: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false
}

module.exports = async (trip, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, trip)

    let pool = await Pool.findOne({ _id: ObjectId(trip.poolId), active: true }).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips').populate('trips')

    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'pool does not exist'
      })
      return
    }

    if (pool.driver._id != driver._id) {
      return socket.emit('error', {
        type: 'pool',
        message: "you are not authorized."
      })
    }

    const res = await Trip.findById(trip.tripId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

    // const res = pool.trips.find((t) => {
    //     return t.passenger == trip.passengerId
    // })

    if (!res) {
      socket.emit('error', {
        type: 'pool',
        message: 'no pool trip found to terminate'
      })
      return
    }

    if (res.pool != trip.poolId) {
      return socket.emit('error', {
        type: "pool",
        message: "the trip specified does not belong to the pool"
      })
    }

    if (res.status == TRIP_STATUS.STARTED) {
      return socket.emit('error', {
        type: 'pool',
        message: "started trips can not be cancelled"
      })
    }



    const setting = await Setting.findOne()

    let commission = setting.defaultCommission
    if (trip.type === TRIP_TYPES.ROAD_PICKUP) {
      commission = setting.defaultRoadPickupCommission
    }
    const tax = setting.cancelCost * (commission / 100)
    res.status = TRIP_STATUS.CANCELLED
    res.endTimestamp = new Date()
    res.cancelledBy = 'Driver'
    res.tax = tax
    res.companyCut = setting.cancelCost
    res.net = (setting.cancelCost * (setting.tax / 100)) - tax
    res.cancelCost = setting.cancelCost
    res.cancelledReason = trip.reason ? trip.reason : ''
    res.active = false
    await res.save()
    // addTrip(res)

    // await updateVehicle(vehicle._id)({ online: true,
    //   // tripId: null
    // })

    await updateWallet({ id: driver._id, amount: -(setting.cancelCost), ride: trip.id })


    await updatePassenger(res.passenger._id)({ inActivePool: false })

    // await emitToDriver(driver._id)('tripStatus', { status: res.status })
    // await emitToDriver(driver._id)('trip', res)
    const updatedPool = await Pool.findOne({ _id: ObjectId(trip.poolId), active: true }).populate({ 
      path: 'trips',
      populate: {
        path: 'passenger',
        model: 'Users'
      } 
    }).populate('vehicleType')

    console.log(">>>>> ", updatedPool.trips.every(trip => !trip.active))
    console.log(">>>>> ", updatedPool.trips)
    if (updatedPool.trips.every(trip => !trip.active)) {
      updatedPool.active = false;
      updatedPool.poolEnded = false;
      await updatedPool.save()
    }

    await emitToDriver(res.driver._id)('pool', updatedPool)

    if (res.passenger) {
      await notifyPassenger(res.passenger._id)({ title: 'Canceled', body: 'You trip has been canceled' })
      // await emitToPassenger(res.passenger._id)('tripStatus', { status: res.status })
      await emitToPassenger(res.passenger._id)('trip', res)
      // sendNotification(passenger.fcm, { title: "Canceled", body: "You trip has been canceled" });
    }

  } catch (error) {
    console.log(error)
  }
}