const { updatePassenger } = require('../../utils/passenger')
const { getNearbyDrivers } = require('../../core')
const { sanitizeInputs } = require('../../utils/core')

const NEARBY_DRIVERS_LIMIT = 20

const schema = {
  type: "object",
  properties: {
    lat: { type: "number" },
    long: { type: "number" },
  },
  required: ["lat", "long"],
  additionalProperties: false
}

module.exports = async (newLocation, passenger, socket) => {
  try {
    await sanitizeInputs(schema, newLocation)

    updatePassenger(passenger._id)({ position: newLocation })

    const drivers = await getNearbyDrivers({ location: newLocation, distance: 100, limit: NEARBY_DRIVERS_LIMIT })
    socket.emit('nearDrivers', JSON.parse(drivers).map(vehicle => {
      return {
        position: {
          long: vehicle.position.coordinates[0],
          lat: vehicle.position.coordinates[1],
        },
        _id: vehicle._id
      }
    }))

  } catch (error) {

  }
}
