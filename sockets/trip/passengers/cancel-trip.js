const Ride = require('../../../models/Ride')
const { emitToDriver, notifyDriver } = require('../../utils/driver')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const Pool = require('../../../models/Pool')
const { updatePassenger, emitToPassenger } = require('../../utils/passenger')

const schema = {
  type: "object",
  properties: {
    id: { type: "string" },
    reason: { type: "string" },
  },
  required: ['id'],
  additionalProperties: false
}


module.exports = async (trip, passenger, socket) => {
  try {
    await sanitizeInputs(schema, trip)

    const res = await Ride.findById(trip.id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
    
    if (res.passenger._id != passenger._id && res.orderedBy != passenger._id) {
      return socket.emit('error', {
        type: 'search',
        message: 'you are not authorized to cancel the trip'
      })
    }

    if (res) {
      res.status = TRIP_STATUS.CANCELLED
      res.endTimestamp = new Date()
      res.cancelledBy = 'Passenger'
      res.cancelledReason = trip.reason ? trip.reason : ''
      res.active = false
      await res.save()
      // addTrip(res)

      if (res.pool) {

        await updatePassenger(passenger._id)({ inActivePool: null })
        let pool = await Pool.findById(res.pool).populate({
          path: 'trips',
          populate: {
            path: 'passenger',
            model: 'Users'
          }
        }).populate('vehicleType')

        if (pool.trips.filter(t => t.active).length === 0) { // on the last passenger
          pool.active = false;
          pool.poolEnded = false;
          pool.completedAt = new Date()
          await pool.save()
        }

        await emitToDriver(pool.driver)('pool', pool)

        notifyDriver(res.driver._id)({ title: 'Canceled', body: 'Trip has been canceled' })
      } else {
        await updateVehicle(res.vehicle._id)({
          online: true,
          inActiveTrip: false,
          // tripId: null
        })
        emitToDriver(res.driver._id)('trip', res)
        notifyDriver(res.driver._id)({ title: 'Canceled', body: 'Trip has been canceled' })
        emitToDriver(res.driver._id)('status', { status: true })

      }

      emitToPassenger(res.passenger._id)('trip', res)
      if (res.orderedBy) {
        emitToPassenger(res.orderedBy)('trip', res)
      }

    } else {
      return socket.emit("error", {
        message: "trip does not exist"
      })
    }
  } catch (error) {
    console.log(error)
  }

}
