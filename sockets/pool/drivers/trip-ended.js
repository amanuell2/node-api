const Incentive = require('../../../models/Incentive')
const Ride = require('../../../models/Ride')
const WalletHistory = require('../../../models/WalletHistory')
const Promo = require('../../../models/Promo')
const Ticket = require('../../../models/Ticket')
const User = require('../../../models/User')
const Driver = require('../../../models/Driver')
const Setting = require('../../../models/Setting')
const { sanitizeInputs } = require('../../utils/core')
const { emitToPassenger, notifyPassenger } = require('../../utils/passenger')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const TRIP_TYPES = require('../../../constants/trip-types')

const { updateWallet } = require('../../../controllers/DriverController')
const { customerEmail, sendEmail } = require('../../../services/emailService')
const { updateVehicle } = require('../../utils/vehicle')
const { updateTicket } = require('../../utils/ticket')
const { sendSMS } = require('../../../services/smsService')

const mongoose = require('mongoose')
const { notifyDriver } = require('../../utils/driver')

const schema = {
  type: 'object',
  properties: {
    tripId: { type: 'string' },
    totalDistance: { type: 'number' },
  },
  required: ['tripId', 'totalDistance'],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {

  try {
    await sanitizeInputs(schema, data)

    const setting = await Setting.findOne()

    const res = await Ride.findById(data.tripId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

    if (res.pool) {
      return socket.emit('pool', await Pool.findOne({
        _id: ObjectId(res.pool)
      }).populate({
        path: 'trips',
        populate: {
          path: 'passenger',
          model: 'Users'
        }
      }).populate('vehicleType'))
    }

    if (res) {
      if (res.status != TRIP_STATUS.COMPLETED) {
        if (res.surge) {
          res.vehicleType.baseFare = res.vehicleType.surgeBaseFare
          res.vehicleType.pricePerKM = res.vehicleType.surgePricePerKM
          res.vehicleType.pricePerMin = res.vehicleType.surgePricePerMin
        }

        let discount = 0
        let tax = 0
        let companyCut = 0
        const date = new Date()
        let payToDriver = 0
        let net = 0
        var tsts = new Date(res.pickupTimestamp);
        var estimatedDuration = res.route.duration // in seconds
        let actualDuration = (date.getTime() - tsts.getTime()) / 1000 // in seconds

        let durationIncludedInBilling = actualDuration / 60

        let cutFromDriver = 0
        let fare = 0
        if ((res.type === TRIP_TYPES.NORMAL) && setting.promoTripCount > 0) {
          var tripCount = await Ride.countDocuments({ passenger: res.passenger._id, status: TRIP_STATUS.COMPLETED })
          if (tripCount % setting.promoTripCount === 0) {
            const t = tripCount / setting.promoTripCount
            discount += setting.promoAmount * (1 + ((setting.promoRate / 100) * t))
          }
        }
        if (res.type == TRIP_TYPES.CORPORATE) {
          fare = (data.totalDistance * res.vehicleType.pricePerKM) + res.vehicleType.baseFare + (durationIncludedInBilling * res.vehicleType.pricePerMin)
          companyCut = (fare * (setting.defaultCommission / 100))
          payToDriver = (fare - companyCut)
          tax = companyCut * (setting.tax / 100)
          net = companyCut - ((tax < 0) ? 0 : tax)
          cutFromDriver = -companyCut
        } else if (res.type === TRIP_TYPES.ROAD_PICKUP) {
          discount = 0
          fare = (data.totalDistance * res.vehicleType.pricePerKM) + res.vehicleType.baseFare + (durationIncludedInBilling * res.vehicleType.pricePerMin)
          companyCut = (fare * (setting.defaultRoadPickupCommission / 100))
          // payToDriver = discount;
          payToDriver = fare - companyCut
          tax = companyCut - (companyCut / ((setting.tax / 100) + 1))
          net = ((fare * (setting.defaultRoadPickupCommission / 100))) - ((tax < 0) ? 0 : tax)
          cutFromDriver = (-(fare * (setting.defaultRoadPickupCommission / 100)))
        } else if (res.type === TRIP_TYPES.NORMAL) {
          fare = (data.totalDistance * res.vehicleType.pricePerKM) + res.vehicleType.baseFare + (durationIncludedInBilling * res.vehicleType.pricePerMin)
          companyCut = (fare * (setting.defaultCommission / 100))
          var tripCount = await Ride.countDocuments({ passenger: res.passenger._id, status: TRIP_STATUS.COMPLETED })
          if (tripCount === 0) {
            discount = setting.discount
          }
          const deductable = fare
          if (deductable <= discount) {
            discount = deductable
          } else {
            discount = discount || 0
          }
          const gross = ((fare * (setting.defaultCommission / 100)) - discount)

          tax = gross > 0 ? gross - (gross / ((setting.tax / 100) + 1)) : 0

          if (discount === 0) {
            tax = companyCut - (companyCut / ((setting.tax / 100) + 1))
          }

          payToDriver = discount

          // tax = ((fare - discount) * (setting.defaultCommission / 100)) * (setting.tax / 100);
          net = ((fare * (setting.defaultCommission / 100)) - discount) - tax
          // cutFromDriver = (-(fare * (setting.defaultCommission / 100))) + discount;
        } else if (res.type === TRIP_TYPES.BID) {
          discount = 0
          payToDriver = 0
          fare = res.bidAmount
          companyCut = (fare * (setting.defaultCommission / 100))
          tax = companyCut - (companyCut / ((setting.tax / 100) + 1))
          net = (fare * (setting.defaultCommission / 100)) - ((tax < 0) ? 0 : tax)
          cutFromDriver = (-companyCut)
        } else {
          fare = (data.totalDistance * res.vehicleType.pricePerKM) + res.vehicleType.baseFare + (durationIncludedInBilling * res.vehicleType.pricePerMin)
          companyCut = (fare * (setting.defaultCommission / 100))
          var tripCount = await Ride.countDocuments({ passenger: res.passenger._id, status: TRIP_STATUS.COMPLETED })
          if (tripCount === 0) {
            discount = setting.discount
          }

          const deductable = fare
          if (deductable <= discount) {
            discount = deductable
          } else {
            discount = discount || 0
          }

          const gross = ((fare * (setting.defaultCommission / 100)) - discount)

          tax = gross > 0 ? gross - (gross / ((setting.tax / 100) + 1)) : 0

          if (discount === 0) {
            discount = 0
            tax = companyCut - (companyCut / ((setting.tax / 100) + 1))
          }
          payToDriver = discount

          // tax = ((fare - discount) * (setting.defaultCommission / 100)) * (setting.tax / 100);
          net = ((fare * (setting.defaultCommission / 100)) - discount) - tax
          // cutFromDriver = (-(fare * (setting.defaultCommission / 100))) + discount;
        }
        res.status = TRIP_STATUS.COMPLETED
        res.totalDistance = data.totalDistance
        res.discount = discount
        res.companyCut = companyCut
        res.tax = tax
        res.fare = fare
        res.payToDriver = payToDriver
        res.net = net
        res.endTimestamp = date
        res.active = false
        await res.save()
        // addTrip(res)

        if (res.ticket) {
          await updateTicket(res.ticket)({ amount: fare, timestamp: new Date() })
          await updateWallet({ id: driver._id, amount: fare, ride: data.tripId, reason: "corporate" })
        }

        await updateWallet({ id: driver._id, amount: -1 * net, ride: data.tripId })

        await updateVehicle(vehicle._id)({
          online: true,
          // tripId: null
        })

        if (res.passenger && res.passenger.email) {
          const emailBody = await customerEmail({ trip: res, setting })
          sendEmail(res.passenger.email, 'Trip summary', emailBody)
        }
        // const driver = getDriver({ id: res.driver._id })
        // if (driver) io.of('/driver-socket').to(driver.socketId).emit('trip', res)

        // socket.emit('tripStatus', { status: res.status })
        socket.emit('trip', res)

        const passengerTripCount = await Ride.countDocuments({ passenger: res.passenger._id, status: TRIP_STATUS.COMPLETED })
        
        const tripDurationInMinutes = (res.endTimestamp.getTime() - res.pickupTimestamp.getTime()) / (1000 * 60)

        if (res.type !== TRIP_TYPES.ROAD_PICKUP && (tripDurationInMinutes >= 10 && tripDurationInMinutes < 180)) {
          for ({ every, rate } of setting.incentiveSettings) {
            if (passengerTripCount % every === 0) {
              const amount = res.fare * (rate / 100)

              await Incentive.create({
                passenger: res.passenger._id,
                ride: res._id,
                rate,
                every,
                tripCount: passengerTripCount,
                passengerTripCount,
                fare: res.fare,
                amount
              })
              await User.updateOne({
                _id: res.passenger._id
              }, {
                $inc: {
                  balance: amount
                }
              })
            }
          } 
        }

        if (res.passenger) {

          await notifyPassenger(res.passenger._id)({ title: 'Trip ended', body: 'You have arrived at your destination' })
          // await emitToPassenger(res.passenger._id)('tripStatus', { status: res.status })
          await emitToPassenger(res.passenger._id)('trip', res)

          const activePromo = await Promo.findOne({
            inviteePhoneNumber: res.passenger.phoneNumber,
            type: "passenger",
            tripCount: { $lt: setting.promoNumberOfTripsApplicable },
            status: "ACTIVE"
          })

          if (activePromo) {

            const promoRate = setting.promoIncentiveRate
            const amount = res.fare * (promoRate / 100)

            const session = await mongoose.startSession();

            await session.withTransaction(async () => {

              // await Incentive.create([{
              //   passenger: res.passenger._id,
              //   ride: res._id,
              //   rate: promoRate,
              //   every: 0,
              //   tripCount: null,
              //   passengerTripCount: null,
              //   fare: res.fare,
              //   amount,
              //   reason: `promo: ${promoRate}%`
              // }], {session: session})
              // await User.updateOne({
              //   _id: res.passenger._id
              // }, {
              //   $inc: {
              //     balance: amount
              //   }
              // }, {session: session})

              if (activePromo.driver) {
                try {
                  const drvr = await Driver.findById(activePromo.driver)

                  if (drvr) {

                    await WalletHistory.create([{
                      driver: activePromo.driver,
                      reason: `promo: ${promoRate}%`,
                      by: 'System',
                      amount: amount,
                      ride: res._id,
                      currentAmount: drvr.ballance
                    }], { session: session })

                    drvr.ballance += amount
                    await drvr.save({ session: session })

                  }

                } catch (err) {
                  console.log(err)
                }
              } else if (activePromo.passenger) {

                await Incentive.create([{
                  passenger: activePromo.passenger,
                  ride: res._id,
                  rate: promoRate,
                  every: 0,
                  tripCount: null,
                  passengerTripCount: null,
                  fare: res.fare,
                  amount,
                  reason: `promo: ${promoRate}%`
                }], { session: session })
                await User.updateOne({
                  _id: activePromo.passenger
                }, {
                  $inc: {
                    balance: amount
                  }
                }, { session: session })
              }

              if (activePromo.tripCount === setting.promoNumberOfTripsApplicable) {
                activePromo.status = "USED"
              }

              await activePromo.save({ session: session })
            })
            session.endSession()
            // try {
            //   await sendSMS(activePromo.passenger ? (await User.findById(activePromo.passenger)).phoneNumber : (await Driver.findById(activePromo.driver)).phoneNumber, `You have received ${amount.toFixed(2)} ETB incentive (trip by ${activePromo.inviteePhoneNumber})`)
            // } catch (error) {
            //   console.log(error)
            // }
            try {
              if (activePromo.passenger) {
                await notifyPassenger(activePromo.passenger)({ title: 'Promo', body: `You have received ${amount.toFixed(2)} ETB incentive (trip by ${activePromo.inviteePhoneNumber})` })
              } else if (activePromo.driver) {
                await notifyDriver(activePromo.driver)({ title: 'Promo', body: `You have received ${amount.toFixed(2)} ETB incentive (trip by ${activePromo.inviteePhoneNumber})` })
              }
            } catch (error) {
              console.log(error)
            }
          }


          const activeDriverPromo = await Promo.findOne({
            inviteePhoneNumber: driver.phoneNumber,
            type: "driver",
            tripCount: { $lt: setting.promoNumberOfTripsApplicable }, // TODO: make this changable from the settings
            status: "ACTIVE"
          })

          if (activeDriverPromo) {

            const promoRate = setting.promoIncentiveRate
            const amount = res.fare * (promoRate / 100)

            // const ballance = driver.ballance + amount // BAD way

            try {

              const drvr = await Driver.findById(driver._id)

              if (drvr) {
                const session = await mongoose.startSession();

                await session.withTransaction(async () => {
                  // await WalletHistory.create([{
                  //   driver: driver._id,
                  //   reason: `promo: ${promoRate}%`,
                  //   by: 'System',
                  //   amount: amount,
                  //   ride: res._id,
                  //   currentAmount: driver.ballance
                  // }], { session: session })


                  // drvr.ballance += amount
                  // await drvr.save({ session: session })

                  if (activeDriverPromo.driver) {
                    try {
                      const drvr = await Driver.findById(activeDriverPromo.driver)

                      if (drvr) {

                        await WalletHistory.create([{
                          driver: activeDriverPromo.driver,
                          reason: `promo: ${promoRate}%`,
                          by: 'System',
                          amount: amount,
                          ride: res._id,
                          currentAmount: drvr.ballance
                        }], { session: session })


                        drvr.ballance += amount
                        await drvr.save({ session: session })

                      }

                    } catch (err) {
                      console.log(err)
                    }
                  } else if (activeDriverPromo.passenger) {

                    await Incentive.create({
                      passenger: activeDriverPromo.passenger,
                      ride: res._id,
                      rate: promoRate,
                      every: 0,
                      tripCount: null,
                      passengerTripCount: null,
                      fare: res.fare,
                      amount,
                      reason: `promo: ${promoRate}%`
                    })
                    await User.updateOne({
                      _id: activeDriverPromo.passenger
                    }, {
                      $inc: {
                        balance: amount
                      }
                    })
                  }




                  activeDriverPromo.tripCount += 1

                  if (activeDriverPromo.tripCount === setting.promoNumberOfTripsApplicable) {
                    activeDriverPromo.status = "USED"
                  }

                  await activeDriverPromo.save({ session: session })

                })
                session.endSession()
                // try {
                //   await sendSMS(activeDriverPromo.passenger ? (await User.findById(activeDriverPromo.passenger)).phoneNumber : (await Driver.findById(activeDriverPromo.driver)).phoneNumber, `You have received ${amount.toFixed(2)} ETB incentive (trip by ${activeDriverPromo.inviteePhoneNumber})`)
                // } catch (error) {
                //   console.log(error)
                // }

                try {
                  if (activeDriverPromo.passenger) {
                    await notifyPassenger(activeDriverPromo.passenger)({ title: 'Promo', body: `You have received ${amount.toFixed(2)} ETB incentive (trip by ${activeDriverPromo.inviteePhoneNumber})` })
                  } else if (activeDriverPromo.driver) {
                    await notifyDriver(activeDriverPromo.driver)({ title: 'Promo', body: `You have received ${amount.toFixed(2)} ETB incentive (trip by ${activeDriverPromo.inviteePhoneNumber})` })
                  }
                } catch (error) {
                  console.log(error)
                }
              }
            } catch (error) {
              console.log(error)
            }

          }

        }
      } else {
        socket.emit('trip', res)
        // socket.emit('tripStatus', { status: res.status })
      }
    }
  } catch (error) {
    console.log(error)
  }

}