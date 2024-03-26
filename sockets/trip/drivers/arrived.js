const Trip = require('../../../models/Ride')
const { emitToDriver } = require('../../utils/driver')
const { notifyPassenger } = require('../../utils/passenger')
const { sanitizeInputs } = require('../../utils/core')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const { emitToPassenger } = require('../../utils/passenger')


const schema = {
  type: "object",
  properties: {
    tripId: { type: "string" },
  },
  required: ["tripId"],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, data)
    const res = await Trip.findById(data.tripId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
    if (res) {
      if (res.status !== TRIP_STATUS.ARRIVED) {
        res.status = TRIP_STATUS.ARRIVED
        res.active = true
        await res.save()
        // addTrip(res)
        emitToDriver(res.driver._id)('trip', res)
        // emitToDriver(res.driver._id)('tripStatus', { status: res.status })
        notifyPassenger(res.passenger._id)({ title: 'Arrived', body: 'Driver has arrived' })
        emitToPassenger(res.passenger._id)('trip', res)
        if (res.orderedBy) {
          emitToPassenger(res.orderedBy)('trip', res)
        }
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
