const { updateWallet } = require('../../../controllers/DriverController')
const Ride = require('../../../models/Ride')
const Vehicle = require('../../../models/Vehicle')
const { notifyDriver, emitToDriver } = require('../../utils/driver')
const { notifyPassenger, emitToPassenger } = require('../../utils/passenger')
const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const TRIP_TYPES = require('../../../constants/trip-types')

const schema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['id'],
  additionalProperties: false
}

module.exports = async (trip, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, trip)

    const setting = await Setting.findOne()
    const res = await Ride.findById(trip.id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

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

    await updateVehicle(vehicle._id)({ online: true,
      inActiveTrip: false,      
      // tripId: null
    })

    await updateWallet({ id: driver._id, amount: -(setting.cancelCost), ride: trip.id })

    // await emitToDriver(driver._id)('tripStatus', { status: res.status })
    await emitToDriver(driver._id)('trip', res)
    await emitToDriver(driver._id)('status', { status: true })

    if (res.passenger) {
      await notifyPassenger(res.passenger._id)({ title: 'Canceled', body: 'You trip has been canceled' })
      // await emitToPassenger(res.passenger._id)('tripStatus', { status: res.status })
      await emitToPassenger(res.passenger._id)('trip', res)
      if (res.orderedBy) {
        await emitToPassenger(res.orderedBy)('trip', res)
      }
      // sendNotification(passenger.fcm, { title: "Canceled", body: "You trip has been canceled" });
    }

  } catch (error) {
    console.log(error)
  }
}
