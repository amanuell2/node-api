const Trip = require('../../../models/Ride')
const { emitToDriver } = require('../../utils/driver')
const { notifyPassenger } = require('../../utils/passenger')
const { sanitizeInputs } = require('../../utils/core')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const { emitToPassenger } = require('../../utils/passenger')
const Pool = require('../../../models/Pool')
const POOL_STATUS = require('../../../constants/pool-statuses')
const { ObjectId } = require('mongoose').Types

const schema = {
  type: "object",
  properties: {
    poolId: { type: "string" },
    tripId: { type: "string" },
  },
  required: ["tripId"],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, data)

    let pool = await Pool.findOne({ _id: ObjectId(data.poolId), active: true }).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips').populate('trips')

    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'pool does not exist'
      })
      return
    }

    console.log(pool.driver)
    if (pool.driver._id != driver._id) {
      return socket.emit('error', {
        type: 'pool',
        message: "you are not authorized."
      })
    }

    const res = await Trip.findById(data.tripId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

    // const res = pool.trips.find((t) => {
    //     return t.passenger == trip.passengerId
    // })

    if (!res) {
      socket.emit('error', {
        type: 'pool',
        message: 'no pool trip found with the identifier'
      })
      return
    }

    if (res.pool != data.poolId) {
      return socket.emit('error', {
        type: "pool",
        message: "the trip specified does not belong to the pool"
      })
    }


    if (res) {
      if (res.status !== TRIP_STATUS.ARRIVED) {
        res.status = TRIP_STATUS.ARRIVED
        res.active = true
        await res.save()
        // addTrip(res)
        emitToDriver(res.driver._id)('pool', await Pool.findOne({ _id: ObjectId(data.poolId), active: true }).populate({ 
          path: 'trips',
          populate: {
            path: 'passenger',
            model: 'Users'
          } 
       }).populate('vehicleType'))
        // emitToDriver(res.driver._id)('tripStatus', { status: res.status })
        notifyPassenger(res.passenger._id)({ title: 'Arrived', body: 'Driver has arrived' })
        emitToPassenger(res.passenger._id)('trip', res)
        // emitToPassenger(res.passenger._id)('tripStatus', { status: res.status })
      } else {
        // socket.emit('tripStatus', { status: res.status })
        socket.emit('trip', res)
      }
    }
  } catch (error) {
    console.log(error)
  }
}