const { updateWallet } = require('../../../controllers/DriverController')
const Rent = require('../../../models/Rent')
const { sendEmail } = require('../../../services/emailService')
const { notifyPassenger, emitToPassenger } = require('../../utils/passenger')
const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const RENT_STATUS = require('../../../constants/rent-statuses')
const moment = require('moment')

// rent. != null && rent.days != null, rent.hours != null

const schema = {
  type: "object",
  properties: {
    rentId: { type: "string" },
  },
  required: ["rentId"],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {

  try {
    await sanitizeInputs(schema, data)

    const setting = await Setting.findOne()

    const res = await Rent.findById(data.rentId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
    if (res) {
      if (res.status != RENT_STATUS.COMPLETED) {
        const tax = setting.tax ? setting.tax : 0
        const companyCut = setting.rentCommission ? setting.rentCommission : 0

        const startDate = moment(res.startTimestamp)
        
        const endDate = moment(new Date())

        const difference = moment.duration(Math.abs(startDate.diff(endDate) / 1000), 'seconds')

        console.log("duration", difference.humanize())
        const discount = (difference) => difference.months() > 0 ? res.vehicleType.rentDiscount / 100 : 0
        
        let rentFare = (
          (difference.months() * (res.vehicleType.rentPerDay * 30)) +
          (difference.hours() * res.vehicleType.rentPerHour) +
          (difference.days() * res.vehicleType.rentPerDay)
        )

        const durationExpected = moment.duration(res.duration, 'hours')
        
        let fareDuration = (
          (durationExpected.months() * (res.vehicleType.rentPerDay * 30)) + 
          (durationExpected.hours() * res.vehicleType.rentPerHour) +
          (durationExpected.days() * res.vehicleType.rentPerDay)
        )
          
        const fare = Math.max(rentFare, fareDuration)

        const cutFromDriver = -fare * (companyCut / 100)
        res.status = RENT_STATUS.COMPLETED
        res.tax = tax
        res.companyCut = companyCut
        res.fare = fare
        res.discount = fare * discount(durationExpected.asMilliseconds() > difference.asMilliseconds() ? durationExpected : difference)
        res.endTimestamp = new Date()
        res.active = false
        await res.save()

        await updateWallet({ id: driver._id, amount: cutFromDriver, rent: data.rentId })

        if (vehicle) {
          const vehicleUpdated = await updateVehicle(vehicle._id)({ online: true,
            // rentId: null
          })

          if (vehicleUpdated) {
            console.log('status updated', true, vehicle._id)
          }
        }
        // if (res.passenger && res.passenger.email) {
        //   sendEmail(res.passenger.email, 'rent summary', 'test email') // TODO: make sendEmail async/await
        // }

        socket.emit('rent', res)

        if (res.passenger) {
          notifyPassenger(res.passenger._id)({ title: 'Rent ended', body: 'You have arrived at your destination' })
          emitToPassenger(res.passenger._id)('rent', res)
        }
      } else {
        socket.emit('rent', res)
      }
    }

  } catch (error) {
    console.log(error)
  }
}
