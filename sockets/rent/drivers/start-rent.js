const Rent = require('../../../models/Rent')
const { emitToDriver } = require('../../utils/driver')
const { sanitizeInputs } = require('../../utils/core')
const { emitToPassenger } = require('../../utils/passenger')
const RENT_STATUS = require('../../../constants/rent-statuses')

const schema = {
  type: "object",
  properties: {
    id: { type: "string" },
  },
  required: ["id"],
  additionalProperties: false
}

module.exports = async (rent, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, rent)

    const res = await Rent.findById(rent.id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

    if (res) {
      if (res.status !== RENT_STATUS.STARTED) {
        res.status = RENT_STATUS.STARTED
        res.active = true
        res.startTimestamp = new Date()
        await res.save()
        emitToDriver(res.driver._id)('rent', res)

        if (res.passenger) {
          emitToPassenger(res.passenger._id)('rent', res)
          notifyPassenger(res.passenger._id)({ title: 'Started', body: 'Rent has started' })
        }
      } else {
        socket.emit('trip', res)
      }
    }

  } catch (error) {

  }

}
