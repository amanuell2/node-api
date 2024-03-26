const Ride = require('../../../models/Ride')
const { emitToDriver, notifyDriver } = require('../../utils/driver')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const TRIP_STATUS = require('../../../constants/trip-statuses')

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
    if (res) {
      res.status = TRIP_STATUS.CANCELLED
      res.endTimestamp = new Date()
      res.cancelledBy = 'Passenger'
      res.cancelledReason = trip.reason ? trip.reason : ''
      res.active = false
      await res.save()
      // addTrip(res)
      await updateVehicle(res.vehicle._id)({ online: true,
        // tripId: null
      })
      emitToDriver(res.driver._id)('trip', res)
      notifyDriver(res.driver._id)({ title: 'Canceled', body: 'Trip has been canceled' })
      emitToDriver(res.driver._id)('status', { status: true })

      // socket.emit('tripStatus', { status: TRIP_STATUS.CANCELLED })
      socket.emit('trip', res)
    }

  } catch (error) {
    console.log(error)
  }

}