const Ride = require('../models/Ride')
const { request, json } = require('express')
const { send } = require('../services/emailService')
const { sendNotification } = require('../services/notificationService')
const { sendEmail, customerEmail } = require('../services/emailService')
const logger = require('../services/logger')
const SOS = require('../models/SOS')
const Setting = require('../models/Setting')
const Incentive = require('../models/Incentive')
const User = require('../models/User')
const Promo = require('../models/Promo')
const Corporate = require('../models/Corporate')
const Driver = require('../models/Driver')
const WalletHistory = require('../models/WalletHistory')
const Ticket = require('../models/Ticket')
const { updateWallet } = require('./DriverController')
const Vehicle = require('../models/Vehicle')
const { getIO } = require('../sockets/io')
const { log } = require('../services/logger')

const { emitToPassenger, notifyPassenger } = require('../sockets/utils/passenger')
const { emitToDriver, notifyDriver } = require('../sockets/utils/driver')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')

const { updateTicket } = require('../sockets/utils/ticket')
const { updateVehicle } = require('../sockets/utils/vehicle')
const { sendSMS } = require('../services/smsService')

const TRIP_TYPES = require('../constants/trip-types')

const mongoose = require('mongoose')

const TRIP_STATUS = require('../constants/trip-statuses')

const index = (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {}

    if (req.query.status && req.query.status != null && req.query.status != 'all') {
      filter.status = {
        $regex: req.query.status, $options: 'i'
      }
    }

    if (req.query.driver != null && req.query.driver != 'all') {
      filter.driver = req.query.driver
    }

    if (req.query.passenger != null && req.query.passenger != 'all') {
      filter.passenger = req.query.passenger
    }

    if (req.query.dispatcher != null && req.query.dispatcher != 'all') {
      filter.dispatcher = req.query.dispatcher
    }

    if (req.query.from || req.query.to) { filter.pickupTimestamp = filterByTimeRange(req.query.from, req.query.to) }

    const trip = Ride.find(filter)
    if (req.query.page && parseInt(req.query.page) != 0) {
      page = parseInt(req.query.page)
    }
    if (req.query.limit) {
      limit = parseInt(req.query.limit)
    }

    if (page > 1) {
      prevPage = page - 1
    }

    skip = (page - 1) * limit

    trip.sort({ createdAt: 'desc' })
    trip.limit(limit)
    trip.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        trip.populate(e)
      })
    }
    Promise.all([
      Ride.countDocuments(filter),
      trip.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }
        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Trip => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  };
}

const checkScheduledTrips = async (io) => {
  try {
    const date = new Date()
    const date2 = date.setHours(date.getHours() + 1)
    const trips = await Ride.find({ status: TRIP_STATUS.SCHEDULED, notified: false, schedule: { $gte: date, $lte: date2 } }).populate('passenger').populate('vehicle')
    trips.forEach((trip) => {
      // const driverId = (trip.driver) ? trip.driver._id : "";
      // const passengerId = (trip.passenger) ? trip.passenger._id : "";

      // var driver = getDriver({ id: driverId});
      // if (driver) {
      //     io.of('/driver-socket').to(driver.socketId).emit('trip', trip);
      // } else
      if (trip.vehicle && trip.vehicle != undefined && trip.vehicle.fcm && trip.vehicle.fcm != undefined) {
        sendNotification(trip.vehicle.fcm, { title: 'Scheduled trip', body: 'You have a scheduled trip.' })
        trip.notified = true
        trip.save()
      } else {
        logger.error('Trip => No driver found')
      }

      // var passenger = getUser({ userId: passengerId });
      // if (passenger) {
      //     io.of('/passenger-socket').to(passenger.socketId).emit('trip', trip);
      // } else
      if (trip.passenger && trip.passenger != undefined && trip.passenger.fcm && trip.passenger.fcm != undefined) {
        sendNotification(trip.passenger.fcm, { title: 'Scheduled trip', body: 'You have a scheduled trip.' })
        trip.notified = true
        trip.save()
      } else {
        logger.error('Trip => No passenger found')
      }
    })
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    // res.status(500).send(error);
  }
}

const latest = (req, res) => {
  try {
    Ride.find({}, 'driver passenger pickUpAddress dropOffAddress status fare passengerName pickupTimestamp endTimestamp ', (error, rides) => {
      if (error) logger.error('Trip => ' + error.toString())
      if (rides) {
        res.send(rides)
      }
    }).limit(30).populate({ path: 'driver', select: 'firstName lastName -_id' }).populate({ path: 'passenger', select: 'firstName lastName -_id' })
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  }
}

const show = async (req, res) => {
  try {
    const trip = await Ride.findById(req.params.id).populate('driver').populate('vehicle').populate('vehicleType').populate('dispatcher').populate('passenger').populate('corporate').populate('ticket').populate('dispatcherWhoEnded', 'firstName lastName')
    res.send(trip)
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  };
}

const sos = async (req, res) => {
  try {
    const sos = await SOS.find({ ride: req.params.id })
    res.send(sos)
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  };
}

const store = async (req, res) => {
  try {
    const savedTrip = await Ride.create(req.body)
    res.send(savedTrip)
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
  try {
    const updatedTrip = await Ride.updateOne({ _id: req.params.id }, req.body)
    res.send(updatedTrip)
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  }
}

const remove = async (req, res) => {
  try {
    const deletedTrip = await Ride.findByIdAndDelete(req.params.id)
    res.send(deletedTrip)
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  }
}

const cancel = async (req, res) => {
  try {
    const io = getIO()
    Ride.findById(req.params.id, async (error, ride) => {
      if (error) console.log(error)
      if (ride) {

        if (ride.status === TRIP_STATUS.CANCELLED || ride.status === TRIP_STATUS.COMPLETED) {
          return res.status(409).send("Trip is already completed or cancelled")
        }

        ride.status = TRIP_STATUS.CANCELLED
        ride.pickupTimestamp = new Date()
        ride.cancelledBy = 'Dispatcher'
        ride.dispatcherWhoEnded = res.locals.user ? res.locals.user._id : null
        ride.cancelledReason = req.body.reason ? req.body.reason : ''
        ride.active = false
        ride.save()
        Vehicle.updateOne({ _id: ride.vehicle._id }, {
          online: true,
          // tripId: null
        }, (error, response) => { })
        await emitToDriver(ride.driver._id)('trip', ride)
        await notifyDriver(ride.driver._id)({ title: 'Canceled', body: 'Trip has been canceled' })
        // const driver = getDriver({ id: ride.driver._id })
        // if (driver) {
        //   io.of('/driver-socket').to(driver.socketId).emit('trip', ride)
        //   sendNotification(driver.fcm, { title: 'Canceled', body: 'Trip has been canceled' })
        //   // io.of('/driver-socket').to(driver.socketId).emit('status', { "status": true });
        // }

        await emitToPassenger(ride.passenger._id)('trip', ride)
        await notifyPassenger(ride.passenger._id)({ title: 'Canceled', body: 'Trip has been canceled' })
        // const passengers = getUsers({ userId: ride.passenger._id })
        // passengers.forEach((passenger) => {
        //   if (passenger) {
        //     io.of('/passenger-socket').to(passenger.socketId).emit('trip', ride)
        //     sendNotification(passenger.fcm, { title: 'Canceled', body: 'Trip has been canceled' })
        //   }
        // })

        res.send(ride)
      }
    }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  }
}

const end = async (req, res) => {
  if (!req.body || (req.body.totalDistance != '0.00' && !req.body.totalDistance)) {
    res.send('totalDistance is required').status(500)
    return
  }
  try {
    const setting = await Setting.findOne()

    Ride.findById(req.params.id, async (error, ride) => {
      if (error) console.log(error)
      if (ride) {
        if (ride.status != TRIP_STATUS.COMPLETED) {
          if (ride.corporate) {
            const corporate = await Corporate.findById(ride.corporate)
            if (corporate.pricing) {
              ride.vehicleType.baseFare = corporate.pricing.baseFare
              ride.vehicleType.pricePerKM = corporate.pricing.pricePerKM
              ride.vehicleType.pricePerMin = corporate.pricing.pricePerMin
            }
          } else if (ride.surge) {
            ride.vehicleType.baseFare = ride.vehicle.surgeBaseFare
            ride.vehicleType.pricePerKM = ride.vehicle.surgePricePerKM
            ride.vehicleType.pricePerMin = ride.vehicle.surgePricePerMin
          }
          const driver = ride.driver
          const vehicle = ride.vehicle
          let discount = 0
          let tax = 0
          let companyCut = 0
          const date = new Date()
          let payToDriver = 0
          let net = 0
          const tsts = new Date(ride.pickupTimestamp)
          const durationInMinute = ((date.getTime() - tsts.getTime()) / 1000) / 60
          let cutFromDriver = 0
          let fare = 0
          if ((ride.type === TRIP_TYPES.NORMAL) && setting.promoTripCount > 0) {
            var tripCount = await Ride.countDocuments({ passenger: ride.passenger._id, status: TRIP_STATUS.COMPLETED })
            if (tripCount % setting.promoTripCount === 0) {
              const t = tripCount / setting.promoTripCount
              discount += setting.promoAmount * (1 + ((setting.promoRate / 100) * t))
            }
          }
          if (ride.type == TRIP_TYPES.CORPORATE) {
            fare = (req.body.totalDistance * ride.vehicleType.pricePerKM) + ride.vehicleType.baseFare + (durationInMinute * ride.vehicleType.pricePerMin)
            companyCut = (fare * (setting.defaultCommission / 100))
            payToDriver = (fare - companyCut)
            tax = companyCut * (setting.tax / 100)
            net = companyCut - ((tax < 0) ? 0 : tax)
            cutFromDriver = -companyCut
          } else if (ride.type === TRIP_TYPES.ROAD_PICKUP) {
            discount = 0
            fare = (req.body.totalDistance * ride.vehicleType.pricePerKM) + ride.vehicleType.baseFare + (durationInMinute * ride.vehicleType.pricePerMin)
            companyCut = (fare * (setting.defaultRoadPickupCommission / 100))
            // payToDriver = discount;
            payToDriver = fare - companyCut
            tax = companyCut - (companyCut / ((setting.tax / 100) + 1))
            net = ((fare * (setting.defaultRoadPickupCommission / 100))) - ((tax < 0) ? 0 : tax)
            cutFromDriver = (-(fare * (setting.defaultRoadPickupCommission / 100)))
          } else if (ride.type === TRIP_TYPES.NORMAL) {
            fare = (req.body.totalDistance * ride.vehicleType.pricePerKM) + ride.vehicleType.baseFare + (durationInMinute * ride.vehicleType.pricePerMin)
            companyCut = (fare * (setting.defaultCommission / 100))
            var tripCount = await Ride.countDocuments({ passenger: ride.passenger._id, status: TRIP_STATUS.COMPLETED })
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
          } else if (ride.type === TRIP_TYPES.BID) {
            discount = 0
            payToDriver = 0
            fare = ride.bidAmount
            companyCut = (fare * (setting.defaultCommission / 100))
            tax = companyCut - (companyCut / ((setting.tax / 100) + 1))
            net = (fare * (setting.defaultCommission / 100)) - ((tax < 0) ? 0 : tax)
            cutFromDriver = (-companyCut)
          } else {
            fare = (req.body.totalDistance * ride.vehicleType.pricePerKM) + ride.vehicleType.baseFare + (durationInMinute * ride.vehicleType.pricePerMin)
            companyCut = (fare * (setting.defaultCommission / 100))
            var tripCount = await Ride.countDocuments({ passenger: ride.passenger._id, status: TRIP_STATUS.COMPLETED })
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
          ride.status = TRIP_STATUS.COMPLETED
          ride.totalDistance = req.body.totalDistance
          ride.discount = discount
          ride.companyCut = companyCut
          ride.tax = tax
          ride.fare = fare
          ride.payToDriver = payToDriver
          ride.net = net
          ride.endTimestamp = date
          ride.active = false
          await ride.save()
          // addTrip(res)

          if (ride.ticket) {
            await updateTicket(ride.ticket)({ amount: fare, timestamp: new Date(), ride: ride._id })
          }

          await updateWallet({ id: driver._id, amount: -1 * net, ride: ride._id })

          await updateVehicle(vehicle._id)({
            online: true,
            inActiveTrip: false,
            // tripId: null
          })

          if (ride.passenger && ride.passenger.email) {
            const emailBody = await customerEmail({ trip: ride, setting })
            sendEmail(ride.passenger.email, 'Trip summary', emailBody)
          }

          if (ride.corporate) {
            const corporate = await Corporate.findById(ride.corporate)

            if (corporate && corporate.email) {
              const emailBody = await customerEmail({ trip: ride, setting })
              sendEmail(corporate.email, 'Corporate Trip summary', emailBody)
            }
          }
          // const driver = getDriver({ id: ride.driver._id })
          // if (driver) io.of('/driver-socket').to(driver.socketId).emit('trip', res)

          // socket.emit('tripStatus', { status: ride.status })
          await emitToDriver(driver._id)('trip', ride)

          const passengerTripCount = await Ride.countDocuments({ passenger: ride.passenger._id, status: TRIP_STATUS.COMPLETED })
          if (ride.type !== TRIP_TYPES.ROAD_PICKUP) {
            for ({ every, rate } of setting.incentiveSettings) {
              if (passengerTripCount % every === 0) {
                const amount = ride.fare * (rate / 100)

                await Incentive.create({
                  passenger: ride.passenger._id,
                  ride: ride._id,
                  rate,
                  every,
                  tripCount: passengerTripCount,
                  passengerTripCount,
                  fare: ride.fare,
                  amount
                })
                await User.updateOne({
                  _id: ride.passenger._id
                }, {
                  $inc: {
                    balance: amount
                  }
                })
              }
            }
          }

          if (ride.passenger) {

            await notifyPassenger(ride.passenger._id)({ title: 'Trip ended', body: 'You have arrived at your destination' })
            // await emitToPassenger(ride.passenger._id)('tripStatus', { status: ride.status })
            await emitToPassenger(ride.passenger._id)('trip', ride)

            const activePromo = await Promo.findOne({
              inviteePhoneNumber: ride.passenger.phoneNumber,
              type: "passenger",
              tripCount: { $lt: setting.promoNumberOfTripsApplicable }, // TODO: make this changable from the settings
              status: "ACTIVE"
            })

            if (activePromo) {

              const promoRate = setting.promoIncentiveRate
              const amount = ride.fare * (promoRate / 100)

              const session = await mongoose.startSession();

              await session.withTransaction(async () => {

                // await Incentive.create([{
                //   passenger: ride.passenger._id,
                //   ride: ride._id,
                //   rate: promoRate,
                //   every: 0,
                //   tripCount: null,
                //   passengerTripCount: null,
                //   fare: ride.fare,
                //   amount,
                //   reason: `promo: ${promoRate}%`
                // }], {session: session})
                // await User.updateOne({
                //   _id: ride.passenger._id
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
                        ride: ride._id,
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
                    ride: ride._id,
                    rate: promoRate,
                    every: 0,
                    tripCount: null,
                    passengerTripCount: null,
                    fare: ride.fare,
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
              const amount = ride.fare * (promoRate / 100)

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
                    //   ride: ride._id,
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
                            ride: ride._id,
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
                        ride: ride._id,
                        rate: promoRate,
                        every: 0,
                        tripCount: null,
                        passengerTripCount: null,
                        fare: ride.fare,
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


            res.status(200).send(ride)
          }
        }
      }
    }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  }
}

const resendEmail = async (req, res) => {
  try {
    const trip = await Ride.findById(req.params.id).populate('driver').populate('passenger').populate('vehicle').populate('vehicleType')

    if (trip && trip.passenger && trip.passenger.email) {
      const email = await customerEmail({ trip })
      if (email) {
        sendEmail(trip.passenger.email, 'Trip summary', email)
        res.send('Email sent!')
      } else {
        res.send('Something went wrong!')
      }
    } else {
      res.send('Passenger does not have email.')
    }
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  }
}

const exportReport = (req, res) => {
  try {
    const filter = {}

    if (req.query.status != null && req.query.status != 'all') {
      filter.status = {
        $regex: req.query.status, $options: 'i'
      }
    }

    if (req.query.driver != null && req.query.driver != 'all') {
      filter.driver = req.query.driver
    }

    if (req.query.passenger != null && req.query.passenger != 'all') {
      filter.passenger = req.query.passenger
    }

    if (req.query.dispatcher != null && req.query.dispatcher != 'all') {
      filter.dispatcher = req.query.dispatcher
    }

    console.log(req.query.passenger)
    filter.pickupTimestamp = filterByTimeRange(req.query.start, req.query.end)

    const trip = Ride.find(filter)

    trip.populate()
    trip.sort({ pickupTimestamp: 'desc' });

    ['driver', 'passenger', 'vehicleType', 'dispatcher'].forEach(model => trip.populate(model))

    trip.exec().then((tripRecords) => {
      const reportData = [
        [
          'Dispatcher',
          'Scheduled',
          'Passenger Name',
          'Driver Name',
          'Pickup / End Time',
          'Pick / Drop Address',
          'Type',
          'Vehicle Type',
          'Fare',
          'Status'
        ].join('\t'),
        ...tripRecords.map(({
          dispatcher,
          schedule,
          passenger,
          driver,
          pickupTimestamp,
          endTimestamp,
          pickUpAddress,
          dropOffAddress,
          vehicleType,
          type,
          fare,
          status
        }) => [
          dispatcher ? dispatcher.firstName +
            ' ' +
            dispatcher.lastName
            : ' - ',
          schedule ? 'Scheduled' : 'Now',
          passenger ? passenger.firstName + ' ' + passenger.lastName
            : 'Unknown',

          driver
            ? driver.firstName + ' ' + driver.lastName 
            : 'Unknown',

          [
            pickupTimestamp || 'Canceled trip',

            endTimestamp || 'Canceled trip'
          ].join(' -> '),

          [
            pickUpAddress.name,
            dropOffAddress.name
          ].join(' -> '),

          type,

          vehicleType ? vehicleType.name : '-',
          fare.toFixed(2),

          status

        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report-trips.xls',
        fileData: reportData
      })
    }).catch((error) => {
      logger.error('Trip => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Trip => ' + error.toString())
    res.status(500).send(error)
  };
}

module.exports = { index, latest, show, store, update, remove, checkScheduledTrips, sos, cancel, end, resendEmail, exportReport }
