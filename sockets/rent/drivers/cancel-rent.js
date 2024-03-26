const Rent = require('../../../models/Rent')
const Vehicle = require('../../../models/Vehicle')
const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const { notifyPassenger, emitToPassenger } = require('../../utils/passenger')
const { emitToDriver } = require('../../utils/driver')
const { updateVehicle } = require('../../utils/vehicle')
const RENT_STATUS = require('../../../constants/rent-statuses')

const schema = {
  type: "object",
  properties: {
    id: { type: "string" },
    reason: { type: "string" },
  },
  required: ["id"],
  additionalProperties: false
}

module.exports = async (rent, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, rent)

    const setting = await Setting.findOne()

    Rent.findById(rent.id, async (err, res) => {
      if (err) console.log(err)
      if (res) {
        const tax = setting.cancelCost * (setting.rentCommission / 100)
        res.status = RENT_STATUS.CANCELLED
        res.endTimestamp = new Date()
        res.tax = tax
        res.companyCut = setting.cancelCost
        res.net = (setting.cancelCost * (setting.tax / 100)) - tax
        res.cancelCost = setting.cancelCost
        res.cancelledBy = 'Driver'
        res.cancelledReason = rent.reason ? rent.reason : ''
        res.active = false
        await res.save()

        if (vehicle) {
          await updateVehicle(vehicle._id)({ online: true,
            // rentId: null
          })
        }

        emitToDriver(driver._id)('rent', res)
        emitToDriver(driver._id)('status', { status: true })

        if (res.passenger) {
          notifyPassenger(req.passenger._id)({ title: 'Canceled', body: 'Your rent has been canceled' })
          emitToPassenger(req.passenger._id)('rent', res)
        }
      }
    }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

  } catch (error) {
    console.log(error)
  }
}
