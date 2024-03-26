const Trip = require('../../../models/Ride')
const { emitToDriver, notifyDriver } = require('../../utils/driver')
const { notifyPassenger } = require('../../utils/passenger')
const { sanitizeInputs } = require('../../utils/core')
const { emitToPassenger } = require('../../utils/passenger')
const Pool = require('../../../models/Pool')

const { ObjectId } = require('mongoose').Types


const schema = {
  type: "object",
  properties: {
    tripId: { type: "string" },
    poolId: { type: "string" },
    message: { type: "string" },
  },
  required: ["tripId", "poolId", "message"],
  additionalProperties: false
}

module.exports = async (data, passenger, socket) => {
  try {
    await sanitizeInputs(schema, data)

    let pool = await Pool.findOne({ _id: ObjectId(data.poolId), active: true }).populate({
      path: 'trips',
      populate: {
        path: 'passenger',
        model: 'Users'
      }
    }).populate('vehicleType')


    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'pool does not exist'
      })
      return
    }
    
    const passengerTrip = pool.trips.find(x => x.passenger._id == passenger._id)
    if (!passengerTrip) {
      return socket.emit('error', {
        type: 'pool',
        message: "you are not authorized."
      })
    }

    pool.chat.push({
      sentByDriver: false,
      message: data.message,
      sentBy: passenger._id
    })
    
    await pool.save()
    await emitToDriver(pool.driver)('pool', pool)

    for (const trip of pool.trips.filter(x => x.active)) {
      await emitToPassenger(trip.passenger._id)('trip', {
        ...(await Trip.findById(trip._id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle'))._doc,
        chat: pool.chat
      })
      await notifyPassenger(trip.passenger._id)({ title: 'Ilift Taxi', body: 'You have a new message' })
    }


  } catch (error) {
    console.log(error)
  }
}