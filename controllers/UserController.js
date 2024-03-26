const User = require('../models/User')
const Ride = require('../models/Ride')
const Rent = require('../models/Rent')
const logger = require('../services/logger')
const Token = require('../models/Token')
const Promo = require('../models/Promo')
const { firebaseAuth } = require('../services/firebase')
const TRIP_STATUS = require('../constants/trip-statuses')

const { ObjectId } = require('mongoose').Types
const ROLES = require('../utils/roles')
const PassengerRecord = require('../models/PassengerRecord')
const Setting = require('../models/Setting')
const { notifyPassenger } = require('../sockets/utils/passenger')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')


const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage

    const user = User.find()
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

    user.sort({ createdAt: 'desc' })
    user.limit(limit)
    user.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        user.populate(e)
      })
    }
    Promise.all([
      User.countDocuments(),
      user.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }
        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Passenger => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  };
}

const adminSearch = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage

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

    try {
      const [results, ..._] = await User
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

      if (results.count) {
        const { count } = results

        // const len = await Driver.countDocuments(filter)
        if (((page * limit) <= count)) {
          nextPage = page + 1
        }

        res.send({ ...results, nextPage, prevPage })
      } else {
        res.send({
          data: [],
          count: 0
        })
      }
    } catch (error) {
      logger.error('Passenger Admin Search => ' + error.toString())
      res.status(500).send(error)
    }

    // user.sort({ createdAt: 'desc' });
    // user.limit(limit);
    // user.skip(skip);
    // if (req.query.populate) {
    //     var populate = JSON.parse(req.query.populate)
    //     populate.forEach((e) => {
    //         user.populate(e);
    //     });
    // }
    // Promise.all([
    //     User.countDocuments(),
    //     user.exec()
    // ]).then((value) => {
    //     if (value) {
    //         if (((page * limit) <= value[0])) {
    //             nextPage = page + 1;
    //         }
    //         res.send({ data: value[1], count: value[0], nextPage, prevPage });
    //     }
    // }).catch((error) => {
    //     logger.error("Passenger => " + error.toString());
    //     res.status(500).send(error);
    // });
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  };
}

const oldAuth = async (req, res) => {
  try {
    if (req.query.token) {
      const token = await Token.findById(req.query.token).populate('passenger')

      if (token && token.active && token.passenger && token.passenger.phoneNumber == req.params.phone) {
        const passenger = token.passenger
        passenger.token = token._id

        const tripCount = await Ride.countDocuments({ passenger: passenger._id, status: TRIP_STATUS.COMPLETED })
        passenger.tripCount = tripCount

        res.send(passenger)
      } else {
        res.status(401).send('Unauthorized')
      }
    } else {
      let passenger = await User.findOne({ phoneNumber: req.params.phone })
      if (passenger) {
        passenger = passenger.toJSON()
        const tripCount = await Ride.countDocuments({ passenger: passenger._id, status: TRIP_STATUS.COMPLETED })
        passenger.tripCount = tripCount

        await Token.updateMany({ passenger: passenger._id }, { active: false })
        const token = await Token.create({ active: true, passenger: passenger._id, role: ROLES.PASSENGER })
        if (token) {
          passenger.token = token._id
          res.send(passenger)
        } else {
          res.status(500).send('Token Error')
        }
      } else {
        res.status(404).send('Unknown Passenger')
      }
    }
  } catch (error) {
    logger.error('Passenger Auth => ' + error.toString())
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
          let passenger = await User.findOne({ phoneNumber })
          if (passenger) {
            passenger = passenger.toJSON()
            const tripCount = await Ride.countDocuments({ passenger: passenger._id, status: TRIP_STATUS.COMPLETED })
            passenger.tripCount = tripCount

            // await Token.updateMany({ passenger: passenger._id }, { active: false })
            const activeToken = await Token.findOne({ active: true, passenger: ObjectId(passenger._id) })

            let token;
            if (activeToken) {
              token = activeToken
            } else {
              token = await Token.create({ active: true, passenger: passenger._id })
            }

            if (token) {
              passenger.token = token._id
              res.status(200).send(passenger)
            } else {
              res.status(500).send('Token Error')
            }
          } else {
            // const newPassenger = await User.create({
            //   phoneNumber
            // })
            // const token = await Token.create({ active: true, passenger: newPassenger._id, role: 6 })
            // if (token) {
            //   newPassenger.token = token._id

            //   res.status(200).send(newPassenger)
            // }
            res.status(404).send("you are not registered")
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

const search = (req, res) => {
  try {
    const filter = {
      $or: [
        {
          firstName: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          lastName: {
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

    let limit = 10

    if (req.query.limit) {
      limit = parseInt(req.query.limit)
    }

    User.find(filter, (error, users) => {
      if (error) {
        logger.error('Passenger => ' + error.toString())
        res.status(500).send(error)
      }

      if (users) {
        res.send(users)
      }
    }).limit(limit)
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

const rents = (req, res) => {
  try {
    Rent.find({ passenger: req.params.id }, (error, rents) => {
      if (error) {
        logger.error('Passenger => ' + error.toString())
        res.status(500).send(error)
      }
      if (rents) {
        res.send(rents)
      }
    }).sort({ createdAt: 'desc' }).limit(15).populate('driver').populate('vehicleType').populate('vehicle')
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

const show = async (req, res) => {
  try {
    const user = await (await User.findById(req.params.id)).toJSON()
    const tripCount = await Ride.countDocuments({ passenger: req.params.id, status: TRIP_STATUS.COMPLETED })
    user.tripCount = tripCount
    res.send(user)
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  };
}

const bookings = (req, res) => {
  try {
    Ride.find({ passenger: req.params.id }, 'driver type passenger pickupTimestamp endTimestamp pickUpAddress dropOffAddress vehicleType totalDistance fare discount status active corporate bidAmount', (err, rides) => {
      res.send(rides)
    }).sort({ createdAt: 'desc' }).limit(15).populate('passenger').populate('driver').populate('vehicleType').populate('vehicle')
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

const scheduledTrips = (req, res) => {
  try {
    Ride.find({ passenger: req.params.id, status: TRIP_STATUS.SCHEDULED }, (error, trips) => {
      if (error) {
        logger.error('Passenger => ' + error.toString())
        res.status(500).send(error)
      }

      if (trips) {
        res.send(trips)
      }
    }).sort({ createdAt: 'desc' }).limit(15).populate('driver').populate('vehicleType').populate('vehicle')
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

const rate = async (req, res) => {
  try {
    if (req.params.id && req.body && req.body.tripId && req.body.rate) {
      const user = await User.findById(req.params.id)

      if (user) {
        const rating = user.rating ? user.rating : 5
        const rateCount = user.rateCount ? user.rateCount : 1
        user.rating = (((rating * rateCount) + req.body.rate) / (rateCount + 1))
        user.rateCount = rateCount + 1
        user.save()
        // user.rating = (((user.rating * user.rateCount) + req.body.rate) / (user.rateCount + 1));
        // user.rateCount = user.rateCount + 1;
        // user.save();
      }

      const trip = await Ride.findById(req.body.tripId)
      if (trip) {
        trip.driverRate = req.body.rate
        trip.save()
      }
      res.send('Rated')
    }
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

const test = async(req, res) => {
  try {
    if (req.query.a)
      await User.deleteOne({email: "email@dsfasd.com"})

      let a = 100000;
      while(true) {
        try {
          
    const savedUser = await User.createWithInviteCode({
      firstName: "test",
      lastName: "test",
      phoneNumber: "+"+a,
      email: "email@dsfasd.com"
    })
    a += 1
    console.log("account created", a, "-", savedUser.inviteCode)
  } catch (error) {
    console.log("failed")         
  }

  }
    if (req.query.c)
      await User.deleteOne({_id: ObjectId(savedUser._id)})
    return res.status(200).send(savedUser)
  } catch (error) {
    console.log(error)
  }
}

const store = async (req, res) => {
  try {
    if (req.body && req.body.firebaseToken && req.body.firstName && req.body.gender) {
      const lastName = !req.body.lastName ? "_" : req.body.lastName
      firebaseAuth()
        .verifyIdToken(req.body.firebaseToken)
        .then(async (decodedToken) => {
          const setting = await Setting.findOne({})
          
          const phoneNumber = decodedToken.phone_number
          let passenger = await User.findOne({ phoneNumber })
          if (passenger) {
            res.status(409).status('you already are registered')
          } else {
            let inviterUser;
            try {
              if (req.body.promo && req.body.promo.length) {
                if (!setting.invitationPromoEnabled) {
                  return res.status(409).send('promo invitation has been disabled')
                }
                inviterUser = await User.findOne({
                  inviteCode: req.body.promo
                })
                if (!inviterUser) {
                  return res.status(404).send('invite code is invalid')
                }
              }
              else {
                console.log("gdsfdfsadfsd")
              }
              const savedUser = await User.createWithInviteCode({
                firstName: req.body.firstName,
                lastName,
                phoneNumber: phoneNumber,
                email: req.body.email,
                gender: req.body.gender
              })

              if (req.body.promo && req.body.promo.length && inviterUser) {
                const inviterAmount = setting.invitationPromoInviterAmount
                await PassengerRecord.create({
                  passenger: inviterUser._id,
                  invitee: savedUser._id,
                  amount: inviterAmount,
                  reason: "a user who has been invited registered"
                })

                await User.updateOne({ _id: inviterUser._id }, {$inc: {balance: inviterAmount}})

                try{
                  await notifyPassenger(inviterUser._id)({ title: 'Promo Bonus', body: `you have received ${inviterAmount} Br. from invitation` })
                } catch {}

                const inviteeAmount = setting.invitationPromoInviteeAmount

                await PassengerRecord.create({
                  passenger: savedUser._id,
                  amount: inviteeAmount,
                  reason: "invitee user registered"
                })

                await User.updateOne({ _id: savedUser._id }, {$inc: {balance: inviteeAmount}})
              }

              res.status(201).send(savedUser)
            } catch (error) {
              res.status(500).send(error)
            }
          }
        }).catch((error) => {
          console.log(error)
          res.status(401).send('Unauthorized')
        })
    } else {
      res.status(422).send('please specify all required fields')
    }

  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

const exportReport = (req, res) => {
  try {

    let page = 1
    let skip = 0
    let limit = 10
    let nextPage
    let prevPage


    console.log("Exporting reports...")
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

    if (req.query.from || req.query.to) { filter.createdAt = filterByTimeRange(req.query.from, req.query.to) }
    
    // filter.pickupTimestamp = filterByTimeRange(req.query.start, req.query.end)

    const passengers = User
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
          },
        },
      ])

    passengers.exec().then((passengerRecords) => {
      console.log("EXECUTED THIS")
      const reportData = [
        [
          'Name',
          'Email',
          'Contact Number',
          'Rating',
        ].join('\t'),
        ...passengerRecords.map(({
          fullName,
          email,
          phoneNumber,
          rating,
        }) => [
          fullName,
          email,
          phoneNumber,
          rating,
        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report-passengers.xls',
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

const update = async (req, res) => {
  try {
    await User.updateOne({ _id: req.params.id }, req.body)
    const user = await User.findById(req.params.id)
    res.send(user)
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

const remove = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id)
    res.send(deletedUser)
  } catch (error) {
    logger.error('Passenger => ' + error.toString())
    res.status(500).send(error)
  }
}

module.exports = { index, auth, oldAuth, bookings, show, store, update, remove, exportReport, rate, search, scheduledTrips, rents, test, adminSearch }