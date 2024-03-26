const Ride = require("../../../models/Ride")
const VehicleType = require("../../../models/VehicleType")
const User = require("../../../models/User")
const { notifyPassenger, emitToPassenger } = require("../../utils/passenger")
const { emitToDriver } = require("../../utils/driver")
const { makeRequest } = require('../../../services/axios')
const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const TRIP_TYPES = require('../../../constants/trip-types')
const { updateTicket } = require("../../utils/ticket")
const Pool = require('../../../models/Pool')
const POOL_STATUS = require('../../../constants/pool-statuses')
const { updateTrip } = require("../../utils/trip")
const { ObjectId } = require('mongoose').Types;
const { updatePool } = require("../../utils/pool")


const schema = {
  type: 'object',
  properties: {
    poolId: { type: "string" },
    tripId: {
      type: 'string'
    },
    distance: { type: 'number' },
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

    if (pool.driver._id != driver._id) {
      return socket.emit('error', {
        type: 'pool',
        message: "you are not authorized."
      })
    }

    const res = await Ride.findById(data.tripId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

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

    if (res.pool != data.poolId) {
      return socket.emit('error', {
        type: "pool",
        message: "the trip specified does not belong to the pool"
      })
    }


    try {

      const poolTrips = await Ride.find({
        pool: data.poolId,
        status: TRIP_STATUS.STARTED
      })

      const distanceCovered = data.distance - pool.distanceCovered > 0 ? data.distance - pool.distanceCovered : 0;
      const poolTripDistanceFareSoFar = (distanceCovered * res.vehicleType.pricePerKM) / (poolTrips.length ? poolTrips.length : 1);

      console.log("DISTANCE:", distanceCovered)
      console.log("DISTANCE FARE:", poolTripDistanceFareSoFar)

      for (const poolTrip of poolTrips) {
        await updatePool(data.poolId)({ distanceCovered: data.distance })
        await updateTrip(poolTrip._id)({fare: poolTrip.fare + poolTripDistanceFareSoFar})
      }

      if (res) {
        if (res.status !== TRIP_STATUS.STARTED) {
          res.status = TRIP_STATUS.STARTED
          res.active = true
          res.pickupTimestamp = new Date()
          res.save()
          if (res.ticket) {
            await updateTicket(res.ticket)({ ride: res._id, active: false })
          }
          // addTrip(res)
          // emitToDriver(res.driver._id)('tripStatus', { status: res.status, pickupTimestamp: res.pickupTimestamp })
          // emitToDriver(res.driver._id)('trip', res)
          emitToDriver(res.driver._id)('pool', await Pool.findOne({ _id: ObjectId(data.poolId), active: true })
          .populate({ 
            path: 'trips',
            populate: {
              path: 'passenger',
              model: 'Users'
            } 
         }).populate('vehicleType'))

          if (res.passenger) {
            notifyPassenger(res.passenger._id)({ title: 'Started', body: 'Trip has started' })
            // emitToPassenger(res.passenger._id)('tripStatus', { status: res.status, pickupTimestamp: res.pickupTimestamp })
            emitToPassenger(res.passenger._id)('trip', res)
            // sendNotification(passenger.fcm, { title: "Started", body: "Trip has started" });
          }
        } else {
          socket.emit('trip', res)
        }
      }
    } catch (error) {
      console.log(error)
    }

  } catch (error) {
    console.log(error)
  }

}