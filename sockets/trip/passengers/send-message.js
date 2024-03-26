const Trip = require('../../../models/Ride')
const { emitToDriver, notifyDriver } = require('../../utils/driver')
const { notifyPassenger } = require('../../utils/passenger')
const { sanitizeInputs } = require('../../utils/core')
const { emitToPassenger } = require('../../utils/passenger')


const schema = {
  type: "object",
  properties: {
    tripId: { type: "string" },
    message: { type: "string" },
  },
  required: ["tripId", "message"],
  additionalProperties: false
}

module.exports = async (data, passenger, socket) => {
  try {
    await sanitizeInputs(schema, data)
    const res = await Trip.findById(data.tripId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
    if (res && res.active) {
        
      if (res.passenger._id != passenger._id) {
        return socket.emit("error", {
          message: "you are not authorized to send messages there."
        })
      }

      res.chat.push({
        sentByDriver: false,
        message: data.message,
        sentBy: res.passenger._id
      })
      
      await res.save()
      emitToDriver(res.driver._id)('trip', res)
      notifyDriver(res.driver._id)({ title: 'Ilift Taxi', body: 'You have a new message' })
      emitToPassenger(res.passenger._id)('trip', res)

    } else {
      socket.emit('error',{ 
        message: "you are not in any active trip"
      })
    }
  } catch (error) {
    console.log(error)
  }
}