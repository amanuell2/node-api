const Driver = require('../models/Driver')
const Vehicle = require('../models/Vehicle')
const Ride = require('../models/Ride')
const mongoose = require('mongoose')
const Token = require('../models/Token')
const Setting = require('../models/Setting')
const Rent = require('../models/Rent')
const WalletHistory = require('../models/WalletHistory')
const logger = require('../services/logger')
const Loan = require('../models/Loan')
const Promo = require('../models/Promo')
const DriverBan = require("../models/DriverBan")
const { firebaseAuth } = require('../services/firebase')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')

const TRIP_STATUS = require('../constants/trip-statuses')
const TRIP_TYPES = require('../constants/trip-types')
const RENT_STATUS = require('../constants/rent-statuses')

const ROLES = require('../utils/roles')
const { getVoucher } = require('../services/voucherService')
const Voucher = require('../models/Voucher')

const { ObjectId } = require('mongoose').Types
const { emitToDriver } = require('../sockets/utils/driver')

const redis = require("redis");
const bluebird = require('bluebird')
const DriverStat = require('../models/DriverStat')
bluebird.promisifyAll(redis.RedisClient.prototype);
const redisClient = redis.createClient({ host: 'ilift-redis-refactored', port: 6379 });


const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      $or: [
        {
          fullName: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          phoneNumber: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          email: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }
      ]
    }

    if (req.query.approved && req.query.approved != 'all') {
      filter.approved = req.query.approved === 'true' ? true
        : req.query.approved === 'false' ? false
          : req.query.approved
    }

    if (req.query.active != null && req.query.active != 'all') {
      filter.active = req.query.active
    }

    filter.createdAt = filterByTimeRange(req.query.from, req.query.to)

    const drives = Driver.find(filter)
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

    drives.sort({ createdAt: 'desc' })
    drives.limit(limit)
    drives.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        drives.populate(e)
      })
    }
    Promise.all([
      Driver.countDocuments(filter),
      drives.exec()
    ]).then(async (value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        const result = value[1].map((driver) => mongoose.Types.ObjectId(driver._id))

        const vehicles = await Vehicle.find({ driver: { $in: result } })

        value[1].map((driver) => {
          const vehicle = vehicles.find((v) => v.driver.toString() == driver._id.toString())
          if (vehicle) {
            driver._doc.vehicle = vehicle
          }
          return driver
        })
        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Driver => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  };
}

const oldAuth = async (req, res) => {
  try {
    if (req.query.token) {
      var token = await Token.findById(req.query.token).populate('driver')
      if (token && token.active && token.driver && token.driver.phoneNumber == req.params.phone) {
        var driver = token.driver
        driver._doc.token = token._id
        var vehicle = await Vehicle.findOne({ driver: driver._id }).populate('vehicleType')
        var setting = await Setting.findOne()
        if (vehicle) {
          res.send({ driver, vehicle, setting })
        } else {
          res.send({ driver, vehicle: null, setting })
        }
      } else {
        res.status(401).send('Unauthorized')
      }
    } else {
      var driver = await Driver.findOne({ phoneNumber: req.params.phone })
      if (driver) {
        await Token.updateMany({ driver: driver._id }, { active: false })
        var token = await Token.create({ active: true, driver: driver._id, role: ROLES.DRIVER })
        if (token) {
          driver._doc.token = token._id
          var vehicle = await Vehicle.findOne({ driver: driver._id }).populate('vehicleType')
          var setting = await Setting.findOne()
          if (vehicle) {
            res.send({ driver, vehicle, setting })
          } else {
            res.send({ driver, vehicle: null, setting })
          }
        } else {
          res.status(500).send('Token Error')
        }
      } else {
        res.status(404).send('Unknown Driver')
      }
    }
  } catch (error) {
    res.status(401).send('Unauthorized')
  };
}

const auth = async (req, res) => {
  try {
    if (req.body && req.body.firebaseAccessToken) {
      firebaseAuth()
        .verifyIdToken(req.body.firebaseAccessToken)
        .then(async (decodedToken) => {
          const phoneNumber = decodedToken.phone_number

          let driver = await Driver.findOne({ phoneNumber })
          if (driver) {
            driver = driver.toJSON()

            // console.log("driver")
            // console.log(driver)

            // await Token.updateMany({ driver: ObjectId(driver._id) }, { active: false })
            await redisClient.delAsync('dr-' + driver._id)
            try {
              await emitToDriver(driver._id)("unauthorized");
            } catch { }
            // const activeToken = await Token.findOne({ active: true, driver: ObjectId(driver._id) })

            let token;
            // if (activeToken) {
            //   token = activeToken
            // } else {

            const driverBan = await DriverBan.findOne({ active: true, driver: ObjectId(driver._id) })

            if (driverBan) {
              console.log("banned driver")
              return res.status(403).send({
                status: "DRIVER_BANNED",
                note: driverBan.note
              })
            }

            token = await Token.create({ active: true, driver: driver._id })
            // }

            if (token) {
              driver.token = token._id

              const vehicle = await Vehicle.findOne({ driver: driver._id }).populate('vehicleType')
              const setting = await Setting.findOne({}, "discount contactNumber requestTimeout surgeTimeFrom surgeTimeUpto creditAllowance mapKey iosDriverVersion androidDriverVersion leastIosDriverVersion leastAndroidDriverVersion driverAppstoreLink driverPlaystoreLink locationUpdateInterval generalGpsAccuracy onTripGpsAccuracy")

              res.status(200).send({
                driver,
                vehicle,
                setting
              })
            } else {
              res.status(500).send('Token Error')
            }
          } else {
            res.status(404).send("you are not registered")
            // res.status(404).send('Unknown Passenger')
          }

        })
        .catch((error) => {
          console.log(error)
          res.status(401).send('Unauthorized')
        })
    } else {
      res.status(401).send('unauthorized')
    }
  } catch (error) {
    logger.error('Passenger Auth => ' + error.toString())
    res.status(401).send('Unauthorized')
  };
}
const search = async (req, res) => {
  try {
    let limit = 10

    let filter

    if (req.query.q && !isNaN(req.query.q)) {
      const q = String(req.query.q)
        .replace(/^09/, '\^\\+2519')
        .replace(/^2519/, '^\\+2519')

      filter = {
        phoneNumber: {
          $regex: q
        }
      }
    } else {
      filter = {
        $or: [
          {
            fullName: {
              $regex: req.query.q ? req.query.q : '', $options: 'i'
            }
          }, {
            phoneNumber: {
              $regex: req.query.q ? req.query.q : '', $options: 'i'
            }
          }, {
            email: {
              $regex: req.query.q ? req.query.q : '', $options: 'i'
            }
          }
        ]
      }
    }

    if (req.query.approved && req.query.approved != 'all') {
      filter.approved = req.query.approved === 'true' ? true
        : req.query.approved === 'false' ? false
          : req.query.approved
    }

    if (req.query.active != null && req.query.active != 'all') {
      filter.active = req.query.active
    }

    filter.createdAt = filterByTimeRange(req.query.from, req.query.to)

    if (req.query.limit != null) {
      limit = parseInt(req.query.limit)
    }

    if (req.query.limit && !isNaN(req.query.limit)) {
      limit = parseInt(req.query.limit)
    }

    try {
      const drivers = await Driver.aggregate([
        {
          $addFields: {
            fullName: { $concat: ['$firstName', ' ', '$lastName'] }
          }
        },
        {
          $match: filter
        },
        {
          $sort: {
            createdAt: -1
          }
        },
        {
          $limit: limit
        }
      ])

      const result = drivers.map((driver) => mongoose.Types.ObjectId(driver._id))
      const vehicles = await Vehicle.find({ driver: { $in: result } }).populate('vehicleType')

      drivers.map((driver) => {
        const vehicle = vehicles.find((v) => v.driver.toString() == driver._id.toString())
        if (vehicle) {
          // driver._doc["vehicle"] = vehicle;
          driver.vehicle = vehicle
        }
        return driver
      })
      res.send(drivers)
    } catch (error) {
      logger.error('Driver search => ' + error.toString())
      res.status(500).send(error)
    }
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const adminSearch = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let nextPage
    let prevPage

    let limit = 10
    const filter = {
      isBanned: false,
      $or: [
        {
          fullName: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          phoneNumber: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          email: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }
      ]
    }

    if (req.query.approved && req.query.approved != 'all') {
      filter.approved = req.query.approved === 'true' ? true
        : req.query.approved === 'false' ? false
          : req.query.approved
    }

    if (req.query.employeesOnly && req.query.employeesOnly != 'all') {
      filter.isEmployee = req.query.employeesOnly === 'true' ? true
        : req.query.employeesOnly === 'false' ? false
          : req.query.employeesOnly
    }

    if (req.query.active != null && req.query.active != 'all') {
      filter.active = req.query.active
    }

    if (req.query.completed != null && req.query.completed != 'all' && ['true', 'false'].includes(req.query.completed.toLowerCase())) {
      const completed = req.query.completed.toLowerCase()
      if (completed === 'true') {
        filter.completed = true
      } else {
        filter.completed = { $ne: true }
      }
    }

    filter.createdAt = filterByTimeRange(req.query.from, req.query.to)

    if (req.query.limit != null) {
      limit = parseInt(req.query.limit)
    }

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

    try {
      const [results, ..._] = await Driver
        .aggregate([
          {
            $addFields: {
              fullName: { $concat: ['$firstName', ' ', '$lastName'] }
            }
          },
          {
            $match: filter
          },
          {
            $sort: {
              createdAt: -1
            }
          },
          {
            $facet: {
              count: [
                {
                  $count: 'value'
                }
              ],
              data: [
                {
                  $skip: skip
                },
                {
                  $limit: limit
                }
              ]
            }
          },
          { $project: { count: { $arrayElemAt: ['$count.value', 0] }, data: '$data' } }
        ])

      if (results) {
        const { count, data } = results

        // const len = await Driver.countDocuments(filter)
        if (((page * limit) <= count)) {
          nextPage = page + 1
        }

        const result = data.map((driver) => mongoose.Types.ObjectId(driver._id))
        const vehicles = await Vehicle.find({ driver: { $in: result } }).populate('vehicleType')

        data.map((driver) => {
          const vehicle = vehicles.find((v) => v.driver.toString() == driver._id.toString())
          if (vehicle) {
            // driver._doc["vehicle"] = vehicle;
            driver.vehicle = vehicle
          }
          return driver
        })
        res.send({ data, count, nextPage, prevPage })
      } else {
        res.send({
          data: [],
          count: 0
        })
      }
    } catch (error) {
      logger.error('Driver Admin Search => ' + error.toString())
      res.status(500).send(error)
    }
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const income = (req, res) => {
  try {
    let monthIncome = 0
    let dailyIncome = 0
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0)


    console.log(start)
    const today = new Date()
    today.setHours(0, 0, 0)

    Promise.all([
      Rent.find({
        driver: req.params.id, endTimestamp: { $gte: start }
      }),
      Ride.find({ driver: req.params.id, endTimestamp: { $gte: start } }),
      
      Ride.countDocuments({ driver: req.params.id, type: TRIP_TYPES.POOL, status: TRIP_STATUS.COMPLETED, endTimestamp: { $gte: today } }),
      Ride.countDocuments({ driver: req.params.id, type: TRIP_TYPES.BID, status: TRIP_STATUS.COMPLETED, endTimestamp: { $gte: today } }),
      Ride.countDocuments({ driver: req.params.id, corporate: { $ne: null }, status: TRIP_STATUS.COMPLETED, endTimestamp: { $gte: today } }),
      Ride.countDocuments({ driver: req.params.id, type: TRIP_TYPES.NORMAL, status: TRIP_STATUS.COMPLETED, endTimestamp: { $gte: today } }),
      Ride.countDocuments({ driver: req.params.id, status: TRIP_STATUS.COMPLETED, endTimestamp: { $gte: today } }),
      Ride.countDocuments({ driver: req.params.id, status: TRIP_STATUS.CANCELLED, cancelledBy: "Driver", endTimestamp: { $gte: today } }),
      
      Ride.find({ driver: req.params.id, endTimestamp: { $gte: today } }),
    ]).then(([
      rents,
      rides,
      poolTrips,
      bidTrips,
      corporateTrips,
      normalTrips,
      completedTrips,
      cancelledTrips,
      todayCompletedTrips
    ]) => {
      const today = new Date()
      rents.forEach((rent) => {
        if (rent.status == RENT_STATUS.COMPLETED) {
          monthIncome += rent.fare - rent.companyCut
          // if (new Date(rent.endTimestamp).getDate() == today.getDate()) {
          //   dailyIncome += rent.fare - rent.companyCut
          // }
        }
      })

      
      rides.forEach((trip) => {
          monthIncome += trip.fare - trip.companyCut
          // if (new Date(trip.endTimestamp).getDate() == today.getDate()) {
          //   dailyIncome += trip.fare - trip.companyCut
          // }
      })
      
      todayCompletedTrips.forEach((trip) => {
        dailyIncome += trip.fare - trip.companyCut
      })

      res.send({
        "Monthly Income": `${monthIncome.toFixed(2)} ETB`,
        "Daily Income": `${dailyIncome.toFixed(2)} ETB`,
        "Pool Trips": poolTrips,
        "Bid Trips": bidTrips,
        "Corporate Trips": corporateTrips,
        "Normal Trips": normalTrips,
        "Completed Trips": completedTrips,
        "Cancelled Trips": cancelledTrips
      })
    }).catch((error) => {
      logger.error('Driver => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const show = (req, res) => {
  try {
    Driver.findById(req.params.id, (error, driver) => {
      if (error) logger.error('Driver => ' + error.toString())
      if (driver) {
        Vehicle.findOne({ driver: driver._id }, (error, vehicle) => {
          if (error) logger.error('Driver => ' + error.toString())
          if (vehicle) {
            res.send({ driver, vehicle })
          } else {
            res.send({ driver, vehicle: null })
          }
        }).populate('vehicleType')
      } else {
        res.status(404).send('Unknown Driver')
      }
    })
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  };
}

const bookings = (req, res) => {
  try {
    Ride.find({ driver: req.params.id }, 'driver, type passenger pickupTimestamp endTimestamp pickUpAddress dropOffAddress vehicleType totalDistance fare discount status active corporate bidAmount', (error, rides) => {
      res.send(rides)
    }).sort({ createdAt: 'desc' }).limit(15).populate('driver').populate('passenger').populate({ path: 'vehicleType', select: 'name -_id' })
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const scheduledTrips = (req, res) => {
  try {
    Ride.find({ driver: req.params.id, status: TRIP_STATUS.SCHEDULED }, (error, trips) => {
      if (error) {
        logger.error('Driver => ' + error.toString())
        res.status(500).send(error)
      }

      if (trips) {
        res.send(trips)
      }
    }).sort({ createdAt: 'desc' }).limit(15).populate('passenger').populate('vehicleType').populate('vehicle')
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const rents = (req, res) => {
  try {
    Rent.find({ driver: req.params.id }, (error, rents) => {
      if (error) {
        logger.error('Driver => ' + error.toString())
        res.status(500).send(error)
      }
      if (rents) {
        res.send(rents)
      }
    }).sort({ createdAt: 'desc' }).limit(15).populate('passenger').populate('vehicleType').populate('vehicle')
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const topUp = (req, res) => {
  try {
    if (req.params.id && req.body.amount && !isNaN(req.body.amount) && req.body.account && req.body.reason, req.body.paymentType) {
      if (req.body.paymentType === 'bank_deposit') {
        if (!(req.body.deposit.by || req.body.deposit.bank || req.body.deposit.transaction || req.body.deposit.narrative || req.body.deposit.date)) {
          return res.status(500).send('Invalid bank deposit data')
        } else {
          WalletHistory.create({ driver: req.params.id, amount: req.body.amount, reason: req.body.reason, by: 'admin', account: req.body.account, paymentType: req.body.paymentType, deposit: req.body.deposit, status: 'unpaid' }, (error, wallet) => {
            if (error) {
              logger.error('Top up by bank deposit => ' + error.toString())
              res.status(500).send(error)
            }
            if (wallet) {
              logger.info(`Driver Bank Deposit recorded => top up, amount = ${req.body.amount}`)
              res.send({ success: true })
            }
          })
        }
      } else {
        Driver.findById(req.params.id, async (error, driver) => {
          if (error) {
            logger.error('Top up => ' + error.toString())
            res.status(500).send(error)
          }
          if (driver) {
            if (parseFloat(req.body.amount) < 0) {
              var topUpAmount = parseFloat(req.body.amount)
              var ballance = driver.ballance + topUpAmount
              Driver.updateOne({ _id: req.params.id }, { ballance }, (error, updateResponse) => {
                if (error) {
                  logger.error('Top up => ' + error.toString())
                  res.status(500).send(error)
                } else if (updateResponse) {
                  WalletHistory.create({
                    driver: req.params.id,
                    amount: parseFloat(req.body.amount),
                    reason: req.body.reason,
                    by: 'admin',
                    account: req.body.account,
                    paymentType: req.body.paymentType,
                    deposit: req.body.deposit
                  }, (error, wallet) => {
                    if (error) {
                      logger.error('Top up => ' + error.toString())
                      res.status(500).send(error)
                    }
                    if (wallet) {
                      logger.info(`Driver => top up, amount = ${topUpAmount} , balance = ${ballance}`)
                      res.send({ ballance })
                    }
                  })
                }
              })
            } else {
              var topUpAmount = parseFloat(req.body.amount)

              var ballance = driver.ballance + topUpAmount
              Driver.updateOne({ _id: req.params.id }, { ballance }, (error, updateResponse) => {
                if (error) {
                  logger.error('Top up => ' + error.toString())
                  res.status(500).send(error)
                } else if (updateResponse) {
                  WalletHistory.create({ driver: req.params.id, amount: topUpAmount, reason: req.body.reason, by: 'admin', account: req.body.account, paymentType: req.body.paymentType }, (error, transaction) => {
                    if (error) {
                      logger.error('Top up => ' + error.toString())
                      res.status(500).send(error)
                    } else if (transaction) {
                      Loan.find({ to: req.params.id, paid: false }, async (error, loans) => {
                        if (error) {
                          logger.error('Top up => ' + error.toString())
                          res.status(500).send(error)
                        } else if (loans) {
                          // var topUpAmount = req.body.amount;
                          for (const unpaidLoan of loans) {
                            const { ballance } = await Driver.findById(req.params.id)

                            if (ballance > unpaidLoan.amount) {
                              const newBalance = ballance - unpaidLoan.amount
                              try {
                                await Driver.updateOne({ _id: req.params.id }, { ballance: newBalance })
                                logger.info(`Driver => top up, amount = ${topUpAmount} , balance = ${newBalance}`)
                              } catch (error) {
                                logger.error('Top up => ' + error.toString())
                              }

                              const secondDriver = await Driver.findById(unpaidLoan.from)
                              if (secondDriver) {
                                secondDriver.ballance = secondDriver.ballance + unpaidLoan.amount
                                await secondDriver.save()
                                await WalletHistory.create({
                                  driver: unpaidLoan.from,
                                  reason: 'Wallet loan pay back',
                                  by: 'System',
                                  amount: unpaidLoan.amount,
                                  from: unpaidLoan.to,
                                  deposit: req.body.deposit
                                })
                                await WalletHistory.create({
                                  driver: unpaidLoan.to,
                                  reason: 'Wallet loan pay back',
                                  by: 'System',
                                  amount: -1 * unpaidLoan.amount,
                                  from: unpaidLoan.from,
                                  deposit: req.body.deposit
                                })
                              }
                              unpaidLoan.paid = true
                              await unpaidLoan.save()
                            }
                          }

                          res.send({ ballance: driver.ballance })

                          // loans.forEach(async (loan) => {
                          //     if (topUpAmount >= loan.amount) {
                          //         topUpAmount -= loan.amount - loan.paidAmount;
                          //         loan.paidAmount = loan.amount;
                          //         loan.paid = true;
                          //         var secondDriver = await Driver.findById(loan.from);
                          //         if (secondDriver) {
                          //             secondDriver.ballance = secondDriver.ballance + loan.paidAmount;
                          //             await secondDriver.save();
                          //             await WalletHistory.create({
                          //                 driver: loan.from,
                          //                 reason: "Wallet loan pay back",
                          //                 by: "System",
                          //                 amount: loan.paidAmount,
                          //                 from: loan.to,
                          //                 deposit: req.body.deposit,
                          //             });
                          //             await WalletHistory.create({
                          //                 driver: loan.to,
                          //                 reason: "Wallet loan pay back",
                          //                 by: "System",
                          //                 amount: -1 * loan.paidAmount,
                          //                 from: loan.from,
                          //                 deposit: req.body.deposit,
                          //             });
                          //         }
                          //     } else if (topUpAmount > 0) {
                          //         topUpAmount = 0;
                          //         loan.paidAmount = topUpAmount;
                          //         loan.paid = false;
                          //         var secondDriver = await Driver.findById(loan.from);
                          //         if (secondDriver) {
                          //             secondDriver.ballance = secondDriver.ballance + loan.paidAmount;
                          //             await secondDriver.save();
                          //             await WalletHistory.create({
                          //                 driver: loan.from,
                          //                 reason: "Wallet loan pay back",
                          //                 by: "System",
                          //                 amount: loan.paidAmount,
                          //                 from: loan.to,
                          //                 deposit: req.body.deposit,
                          //             });
                          //             await WalletHistory.create({
                          //                 driver: loan.to,
                          //                 reason: "Wallet loan pay back",
                          //                 by: "System",
                          //                 amount: -1 * loan.paidAmount,
                          //                 from: loan.from,
                          //                 deposit: req.body.deposit,
                          //             });
                          //         }
                          //     }
                          //     await loan.save();
                          // });
                        }
                      })
                    }
                  })
                }
              })
            }
          } else {
            res.status(500).send('Invalid data')
          }
        })
      }
    }
  } catch (error) {
    logger.error('Top up => ' + error.toString())
    res.status(500).send(error)
  }
}

const walletHistory = (req, res) => {
  try {
    WalletHistory.find({ driver: req.params.id }, (error, walletHistory) => {
      if (error) {
        logger.error('Driver => ' + error.toString())
        res.status(500).send(error)
      }
      if (walletHistory) {
        res.send(walletHistory)
      }
    }).sort({ createdAt: 'desc' }).limit(20).populate('driver').populate('account')
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const stats = (req, res) => {
  try {
    DriverStat.findOne({ driver: req.params.id }, (error, driverStat) => {
      if (error) {
        console.log("driver stats")
        logger.error('Driver => ' + error.toString())
        res.status(500).send(error)
      }
      if (driverStat) {
        res.send(driverStat)
      }
    }).populate('driver').populate('vehicle')
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const walletTransfer = async (req, res) => {
  try {
    if (req.params.id && req.body.amount && req.body.amount > 0 && req.body.to) {
      const session = await mongoose.startSession();

      await session.withTransaction(async () => {

        const driver = await Driver.findById(req.params.id, null, { session: session })

        if (driver) {
          if (driver.ballance > req.body.amount) {
            driver.ballance = driver.ballance - req.body.amount
            await driver.save({ session: session })
            logger.info(`Driver ${req.params.id} => Wallet transfer, amount = ${req.body.amount} , balance = ${driver.ballance}`)
            const secondDriver = await Driver.findById(req.body.to, null, { session: session })
            if (secondDriver) {
              secondDriver.ballance += req.body.amount
              await secondDriver.save({ session: session })
              logger.info(`Driver ${req.body.to} => Wallet transfer, amount = ${req.body.amount} , balance = ${secondDriver.ballance}`)
              const response = await Promise.all([
                WalletHistory.create([{
                  driver: driver._id,
                  reason: 'wallet transfer',
                  by: 'System',
                  from: secondDriver._id,
                  amount: -1 * parseFloat(req.body.amount)
                }], { session: session }),
                WalletHistory.create([{
                  driver: secondDriver._id,
                  reason: 'wallet transfer',
                  by: 'System',
                  from: driver._id,
                  amount: parseFloat(req.body.amount)
                }], { session: session })
              ])

              res.status(200).send('success')
              // res.status(200).send("success")
            } else {
              console.log("second driver not found")
              throw new Error('second driver not found')
            }
          } else {
            console.log("balance too low")

            res.status(500).send('your ballance is low')
            throw new Error("balance too low")
          }
        } else {
          console.log("driver not found")

          throw new Error('driver not found')
        }
      })

      session.endSession()
    } else {
      console.log("invalid data")

      res.status(500).send('invalid data')
    }
  } catch (error) {
    console.log(error)
    logger.error('Wallet transfer => ' + error.toString())
    res.status(500).send(error)
  }
}

const lend = async (req, res) => {
  try {
    if (req.params.id && req.body.amount && req.body.amount > 0 && req.body.to) {

      const session = await mongoose.startSession();

      await session.withTransaction(async () => {
        const driver = await Driver.findById(req.params.id, null, { session: session })

        if (driver) {
          if (driver.ballance > req.body.amount) {
            const loan = await Loan.create([{
              from: req.params.id,
              to: req.body.to,
              amount: req.body.amount,
              paid: false
            }], { session: session })

            if (loan) {
              driver.ballance = driver.ballance - req.body.amount
              await driver.save({ session: session })
              logger.info(`Driver ${req.params.id} => Wallet loan, amount = ${req.body.amount} , balance = ${driver.ballance}`)
              const secondDriver = await Driver.findById(req.body.to, null, { session: session })

              if (secondDriver) {
                secondDriver.ballance += req.body.amount
                await secondDriver.save({ session: session })
                logger.info(`Driver ${req.body.to} => Wallet loan, amount = ${req.body.amount} , balance = ${secondDriver.ballance}`)

                const response = await Promise.all([
                  WalletHistory.create([{
                    driver: driver._id,
                    reason: 'wallet loan',
                    by: 'System',
                    from: secondDriver._id,
                    amount: -1 * parseFloat(req.body.amount)
                  }], { session: session }),
                  WalletHistory.create([{
                    driver: secondDriver._id,
                    reason: 'wallet loan',
                    by: 'System',
                    from: driver._id,
                    amount: parseFloat(req.body.amount)
                  }], { session: session })
                ])

                res.status(200).send('success')


              } else {
                console.log("second driver not found")
                throw new Error('second driver not found')
              }

            }
          } else {
            console.log("balance too low")

            res.status(500).send('your ballance is low')
            throw new Error("balance too low")
          }
        } else {
          console.log("driver not found")

          throw new Error('driver not found')
        }
      })

      session.endSession()


    } else {
      logger.error('Wallet lend => ' + error.toString())
      res.status(500).send('invalid data')
    }
  } catch (error) {
    logger.error('Wallet lend => ' + error.toString())
    res.status(500).send(error)
  }
}

const rate = async (req, res) => {
  try {
    if (req.params.id && req.body && req.body.tripId && req.body.rate) {
      const driver = await Driver.findById(req.params.id)

      if (driver && req.body.rate) {
        const rating = driver.rating ? driver.rating : 5
        const rateCount = driver.rateCount ? driver.rateCount : 1
        driver.rating = (((rating * rateCount) + req.body.rate) / (rateCount + 1))
        driver.rateCount = rateCount + 1
        driver.save()
      }

      const trip = await Ride.findById(req.body.tripId)
      if (trip) {
        trip.passengerRate = req.body.rate
        trip.save()
      }
      res.send('Rated')
    }
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const updateWallet = async (data) => {
  try {

    const driver = await Driver.findById(data.id)

    if (driver.isEmployee) {
      console.log("driver is employee")
      return 
    }

    if (driver) {
      const session = await mongoose.startSession();

      const previousTransaction = await WalletHistory.findOne({
        ride: ObjectId(data.ride),
        reason: data.reason ? data.reason : 'commission'
      })

      if (previousTransaction) {
        console.log("avoided duplicate transaction")
        return
      }

      await session.withTransaction(async () => {
        driver.ballance += data.amount

        const wallet = await WalletHistory.create([{
          driver: data.id,
          reason: data.reason ? data.reason : 'commission',
          by: 'System',
          amount: data.amount,
          ride: data.ride,
          currentAmount: driver.ballance
        }], { session: session })
        await driver.save({ session: session })

        if (wallet) {
          // console.log("<<>><<>>", wallet)
          // await wallet.save({ session: session })
          logger.info(`Driver => ${data.id}  commission, amount = ${data.amount} , balance = ${driver.ballance}`)
          // res.status(200).send('success')
        } else {
          throw new Error("failed to create")
        }
      })

      session.endSession()
    }
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    // res.status(500).send(error)
  }
}

const store = async (req, res) => {
  try {
    if (req.body && req.body.firebaseToken && req.body.firstName) {
      const lastName = !req.body.lastName ? "_" : req.body.lastName
      firebaseAuth()
        .verifyIdToken(req.body.firebaseToken)
        .then(async (decodedToken) => {
          const phoneNumber = decodedToken.phone_number
          let driver = await Driver.findOne({ phoneNumber })
          if (driver) {
            res.status(409).status('you already are registered')
          } else {
            try {
              const savedDriver = await Driver.create({
                firstName: req.body.firstName,
                lastName: lastName,
                profileImage: req.body.profileImage,
                phoneNumber: phoneNumber,
                email: req.body.email,
                businessLicense: req.body.businessLicense,
                representationPaper: req.body.representationPaper,
                drivingLicense: req.body.drivingLicense,
                isFemaleDriver: req.body.isFemaleDriver
              })

              try {

                await Promo.findOneAndUpdate({
                  inviteePhoneNumber: phoneNumber,
                  type: "driver",
                  status: "INVITED"
                }, {
                  status: "ACTIVE"
                })
              } catch (err) {
                console.log(err)
              }

              res.status(201).send(savedDriver)
            } catch (error) {
              console.log(error)
              res.status(500).send(error)
            }
          }
        }).catch((error) => {
          console.log(error)
          res.status(401).send('Unauthorized')
        })
    } else if (req.headers.authorization) {
      // const authHeader = req.headers.authorization
      // let accessToken;

      // const allowedRoles = [ROLES.ADMIN, ROLES.DISPATCHER, ROLES.OPERATION]

      // if (authHeader) {
      //   const [scheme, token] = authHeader.split(' ')

      //   if (scheme === 'Bearer' && token) {
      //     accessToken = token
      //   }
      // }

      // if (accessToken) {
      //   Token.findById(accessToken).populate('account').then(async (token) => {
      //     if (token && token.active) {
      //       if (allowedRoles.includes(token.role) || token.account.roles.some(value => allowedRoles.includes(value))) {
              try {
                const savedDriver = await Driver.create(req.body)
                await Promo.findOneAndUpdate({
                  inviteePhoneNumber: req.body.phoneNumber,
                  type: "driver",
                  status: "INVITED"
                }, {
                  status: "ACTIVE"
                })
                res.status(201).send(savedDriver)
              } catch (error) {
                res.status(422).send(error)
              }
        //     } else {
        //       res.status(403).send('Insufficient Permission')
        //     }
        //   } else {
        //     res.status(401).send('UNAUTHORIZED')
        //   }
        // }).catch(err => {
        //   console.log(err)
        //   res.status(500).send('Internal Error while trying to authenticate via token')
        // })
      // } else {
      //   res.status(401).send('UNAUTHORIZED')
      // }
    } else {
      res.status(422).send('please specify all required fields')
    }
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
  try {
    const updatedDriver = await Driver.updateOne({ _id: req.params.id }, req.body, { runValidators: true })

    if (req.body.vehicleType) {
    try {
      await Vehicle.updateOne({ driver: ObjectId(req.params.id) }, { $set: { vehicleType: req.body.vehicleType } })
    } catch {
    }
  }

    try {
      await Vehicle.updateOne({ driver: ObjectId(req.params.id) }, { $set: { isFemaleDriver: req.body.isFemaleDriver } })
    } catch {
    }

    // const driverVehicle = await Vehicle.findOne({ driver: ObjectId(req.params.id) })

    // if (driverVehicle) {
    //   driverVehicle.isFemaleDriver = req.body.isFemaleDriver
    //   await driverVehicle.save()
    // }

    res.send(await Driver.findOne({_id: req.params.id }))
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send({ message: 'error => ' + error })
  }
}

const remove = async (req, res) => {
  try {
    const deletedDriver = await Driver.deleteOne({ _id: req.params.id })
    res.send(deletedDriver)
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}

const buyAirTime = async (req, res) => {
  const setting = await Setting.findOne()

  const VALID_AMOUNTS = setting.voucherSettings.voucherTypes.map(({ amount }) => amount)

  try {
    const authHeader = req.headers.authorization

    if (authHeader) {
      const [scheme, tokenSection] = authHeader.split(' ')

      if (scheme === 'Bearer' && tokenSection) {
        const accessToken = tokenSection

        const token = await Token.findById(accessToken).populate('driver')
        if (token && token.active && token.driver) {
          if (req.body.amount && !isNaN(req.body.amount)) {
            const amount = Number(req.body.amount)
            if (VALID_AMOUNTS.includes(amount)) {
              const driver = token.driver

              if (driver.ballance > amount) {
                try {
                  const voucher = await getVoucher(amount)

                  if (voucher && voucher.voucher) {
                    await Voucher.create({
                      driver: driver._id,
                      ...voucher
                    })

                    const wallet = await WalletHistory.create({
                      driver: driver._id,
                      amount: parseFloat(amount),
                      reason: `Voucher Cashout (AirTime): ${amount} Birr`,
                      by: 'App',
                      paymentType: "airtime buy",
                    })
                    if (wallet) {
                      // await Incentive.create({
                      //   passenger: passenger._id,
                      //   amount: -1 * amount,
                      //   voucher: incentiveVoucher._id,
                      //   status: 'collected',
                      //   reason: `Voucher Cashout: ${amount} Birr`
                      // })
                      await Driver.updateOne({
                        _id: driver._id
                      }, {
                        $inc: {
                          ballance: -1 * amount
                        }
                      })

                      return res.status(200).send({
                        voucher,
                        newBalance: driver.ballance - amount
                      })
                    } else {
                      console.log("voucher record not created")
                      return res.status(500).send('internal error')
                    }

                  } else {
                    res.status(500).send('voucher system error')
                  }
                } catch (error) {
                  console.log(error)
                  if (error && error.message) { res.status(500).send(error.message) } else { res.status(500).send('internal error') }
                }
              } else {
                res.status(409).send('insufficient balance')
              }
            } else {
              return res.status(422).send(`amount must be one of ( ${VALID_AMOUNTS.join(', ')} )`)
            }
          } else {
            return res.status(422).send('you must send a valid amount')
          }
        } else {
          return res.status(401).send('Unauthorized')
        }
      } else {
        return res.status(401).send('Unauthorized')
      }
    } else {
      return res.status(401).send('Unauthorized')
    }
  } catch (err) {
    logger.error('cashout incentive => ' + err.toString())
    res.status(500).send('internal error')
  }
}

const myVouchers = async (req, res) => {
  try {
    const authHeader = req.headers.authorization

    if (authHeader) {
      const [scheme, tokenSection] = authHeader.split(' ')

      if (scheme === 'Bearer' && tokenSection) {
        const accessToken = tokenSection

        const token = await Token.findById(accessToken).populate('driver')
        if (token && token.active && token.driver) {
          const driver = token.driver

          const prevVouchers = await Voucher.find({
            driver: driver._id,
          }).limit(req.query.limit ? Number(req.query.limit) : 20)

          res.status(200).send(prevVouchers)
        } else {
          return res.status(401).send('Unauthorized')
        }
      } else {
        return res.status(401).send('Unauthorized')
      }
    } else {
      return res.status(401).send('Unauthorized')
    }
  } catch (err) {
    logger.error('air time buy => ' + err.toString())
    res.status(500).send('internal error')
  }
}

const exportReport = async (req, res) => {
  try {
    const filter = {
      $or: [
        {
          fullName: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          phoneNumber: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          email: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }
      ]
    }

    if (req.query.approved && req.query.approved != 'all') {
      filter.approved = req.query.approved === 'true' ? true
        : req.query.approved === 'false' ? false
          : req.query.approved
    }

    if (req.query.active != null && req.query.active != 'all') {
      filter.active = req.query.active
    }

    filter.createdAt = filterByTimeRange(req.query.start, req.query.end)

    try {
      const drivers = await Driver
        .aggregate([
          {
            $addFields: {
              fullName: { $concat: ['$firstName', ' ', '$lastName'] }
            }
          },
          {
            $match: filter
          },
          {
            $sort: {
              createdAt: -1
            }
          }
        ])

      const result = drivers.map((driver) => mongoose.Types.ObjectId(driver._id))
      const vehicles = await Vehicle.find({ driver: { $in: result } }, 'plateNumber id driver vehicleType').populate('vehicleType', 'name')

      drivers.map((driver) => {
        const vehicle = vehicles.find((v) => v.driver.toString() == driver._id.toString())
        if (vehicle) {
          // driver._doc["vehicle"] = vehicle;
          driver.vehicle = vehicle
        }
        return driver
      })

      const reportData = [
        ['Name', 'Email', 'Contact Number', 'Rating', 'Balance', 'Vehicle Type', 'Plate Number', 'Status', 'Has a complete profile', 'Registered'].join('\t'),
        ...drivers.map(({
          fullName,
          email,
          phoneNumber,
          rating,
          ballance,
          vehicle,
          approved,
          completed,
          createdAt
        }) => [
          fullName,
          email,
          phoneNumber,
          rating,
          ballance,
          vehicle && vehicle.vehicleType ? vehicle.vehicleType.name : 'N/A',
          vehicle ? vehicle.plateNumber : ' N/A ',
          approved ? 'Approved' : 'Not Approved',
          completed,
          createdAt
        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report.xls',
        fileData: reportData
      })
    } catch (error) {
      logger.error('Driver => ' + error.toString())
      res.status(500).send(error)
    }
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}
module.exports = { index, auth, oldAuth, show, bookings, store, update, remove, rate, search, adminSearch, scheduledTrips, rents, topUp, walletHistory, stats, income, updateWallet, walletTransfer, lend, buyAirTime, myVouchers, exportReport }