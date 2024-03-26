const Rent = require('../../../models/Rent')
const Vehicle = require('../../../models/Vehicle')
const { emitToDriver, notifyDriver } = require('../../utils/driver')
const { sanitizeInputs } = require('../../utils/core')
const RENT_STATUS = require('../../../constants/rent-statuses')

const schema = {
  type: "object",
  properties: {
    id: { type: "string" },
    reason: { type: "string" },
  },
  required: ['id'],
  additionalProperties: false
}

module.exports = async (data, passenger, socket) => {
  try {
    await sanitizeInputs(schema, data)

    const res = await Rent.findById(data.id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
    if (res) {
      res.status = RENT_STATUS.CANCELLED
      res.endTimestamp = new Date()
      res.cancelledBy = 'Passenger'
      res.cancelledReason = data.reason ? data.reason : ''
      res.active = false
      res.save()
      await Vehicle.updateOne({ _id: res.vehicle._id }, { online: true,
        // rentId: null
      })
      emitToDriver(res.driver._id)('rent', res)
      notifyDriver(res.driver._id)({ title: 'Canceled', body: 'Rent has been canceled' })
      emitToDriver(res.driver._id)('status', { status: true })

      socket.emit('rent', res)
    }

  } catch (error) {
    console.log(error)
  }
}
