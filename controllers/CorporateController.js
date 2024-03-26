const Corporate = require('../models/Corporate')
const bcrypt = require('bcryptjs')
const Ticket = require('../models/Ticket')
const Ride = require('../models/Ride')
const Account = require('../models/Account')
const CorporatePayment = require('../models/CorporatePayment')
const logger = require('../services/logger')
const Employee = require('../models/Employee')
const TripSearch = require('../models/TripSearch')
const TripRequest = require('../models/TripRequest')
const Setting = require('../models/Setting')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')

const { emitToDriver, notifyDriver } = require('../sockets/utils/driver')
const { notifyPassenger, emitToPassenger } = require('../sockets/utils/passenger')
const { updateVehicle } = require('../sockets/utils/vehicle')


const TRIP_SEARCH_STATUSES = require('../constants/trip-search-statuses')
const TRIP_REQUEST_STATUSES = require('../constants/trip-request-statuses')

const passengerTasks = require('../jobs/passenger')

const mongoose = require('mongoose')

const { ObjectId } = mongoose.Types

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage

    const filter = {}

    if (req.query.q != null) {
      filter.$or = [
        {
          name: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          shortName: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }
      ]
    }

    const corporates = Corporate.find(filter)
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

    corporates.sort({ createdAt: 'desc' })
    corporates.limit(limit)
    corporates.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        corporates.populate(e)
      })
    }
    Promise.all([
      Corporate.countDocuments(filter),
      corporates.exec()
    ]).then(async (value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Corporate => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  };
}

const listOfCorporates = async (req, res) => {
  try {
    const corporates = await Corporate.find({})
  
    res.send({ data: corporates })
  } catch (error) {
    logger.error('Corporates list => ' + error.toString())
    res.status(500).send(error)
  };
}

const listOfEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({
      corporate: req.query.corporate
    })
    res.send({ data: employees })
  } catch (error) {
    logger.error('Employees list => ' + error.toString())
    res.status(500).send(error)
  };
}

const retryTripSearch = async (req, res) => {
  try {
    const tripSearch = await TripSearch.findOne({
      status: {
        $in: [
          TRIP_SEARCH_STATUSES.NO_DRIVERS_FOUND,
          TRIP_SEARCH_STATUSES.CANCELLED,
        ]
      },
      _id: ObjectId(req.params.tripSearchId)
    })

    if (tripSearch) {
      // TODO: move those actions to stopSearchingForRides
      tripSearch.status = TRIP_SEARCH_STATUSES.IN_PROGRESS
      tripSearch.active = true
      // tripSearch.requestedVehicles = []
      tripSearch.searchRound += 1
      await tripSearch.save()

      const setting = await Setting.findOne()
      await passengerTasks.startSearchingForRides(
        tripSearch,
        `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
      )

      res.send(tripSearch)
    } else {
      res.status(404).send('trip search not found or has been completed')
    }
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  }
}

const restartTripSearch = async (req, res) => {
  try {
    const tripSearch = await TripSearch.findOne({
      status: { $ne: TRIP_SEARCH_STATUSES.IN_PROGRESS },
      _id: ObjectId(req.params.tripSearchId)
    })

    if (tripSearch) {
      let corporate
      if (tripSearch.corporate) {
        corporate = await Corporate.findById(tripSearch.corporate)
      }
      let code = corporate.shortName + ':' + Math.random().toString(36).slice(2, 8)
      let found = false

      while (!found) {
        const ticket = await Ticket.findOne({ code })
        if (ticket) {
          code = corporate.shortName + ':' + Math.random().toString(36).slice(2, 8)
        } else {
          found = true
        }
      }
      ticket = await Ticket.create({ code, corporate: tripSearch.corporate, employee: tripSearch.employee })

      // if (!ticket)
      //     return socket.emit('error', { message: "something went wrong while generating ticket" })

      const newTripSearch = await TripSearch.create({
        active: true,
        passenger: tripSearch.passenger,
        requestedVehicles: [],
        dispatcher: res.locals.users ? res.locals.user._id : null,
        pickUpAddress: tripSearch.pickUpAddress,
        dropOffAddress: tripSearch.dropOffAddress,
        vehicleType: tripSearch.vehicleType,
        route: tripSearch.route,
        ticket: ticket,
        note: tripSearch.note ? tripSearch.note : '',
        corporate: tripSearch.corporate, // TODO: add corporate
        schedule: tripSearch.schedule,
        bidAmount: tripSearch.bidAmount && tripSearch.type == "bid" ? tripSearch.bidAmount : null,
        type: tripSearch.type,
        employee: tripSearch.employee
      })

      const setting = await Setting.findOne()

      await passengerTasks.startSearchingForRides(
        newTripSearch,
        `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
      )

      res.send(newTripSearch)
    } else {
      res.status(404).send('trip search not found or is already in progress')
    }
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  }
}

const cancelTripSearch = async (req, res) => {
  try {
    const tripSearch = await TripSearch.findOne({
      status: TRIP_SEARCH_STATUSES.IN_PROGRESS,
      _id: ObjectId(req.params.tripSearchId)
    })

    if (tripSearch) {
      // TODO: move those actions to stopSearchingForRides
      tripSearch.status = TRIP_SEARCH_STATUSES.CANCELLED
      tripSearch.cancelledBy = 'Dispatcher'
      tripSearch.cancelledReason = req.body.reason ? req.body.reason : ''
      tripSearch.active = false
      tripSearch.dispatcherWhoCancelled = res.locals.user ? res.locals.user._id : null
      await tripSearch.save()

      console.log(tripSearch)

      const activeRequests = await TripRequest.find({
        status: TRIP_REQUEST_STATUSES.IN_REQUEST,
        tripSearchId: tripSearch._id
      })

      await passengerTasks.stopSearchingForRides(tripSearch)

      for (const activeRequest of activeRequests) {

        activeRequest.cancelledBy = 'Dispatcher'
        activeRequest.cancelledReason = req.body.reason ? req.body.reason : ''
        activeRequest.active = false
        activeRequest.dispatcherWhoCancelled = res.locals.user ? res.locals.user._id : null
        await activeRequest.save()

        await updateVehicle(activeRequest.vehicle)({
          online: true,
          // TripRequestId: null
        })

        await emitToDriver(activeRequest.driver)('requestCanceled')
        await notifyDriver(activeRequest.driver)({ title: 'Request Canceled', body: 'Request has been cancelled' })
      }
      await emitToPassenger(tripSearch.passenger)('requestCanceled')
      await notifyPassenger(tripSearch.passenger)({ title: 'Request Canceled', body: 'Request has been cancelled' })

      res.send(tripSearch)
    } else {
      res.status(404).send('trip search not found or is not active')
    }
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  }
}


const trips = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      corporate: req.params.id,
      schedule: null
    }

    if (req.query.status && req.query.status != null && req.query.status != 'all') {
      filter.status = {
        $regex: req.query.status, $options: 'i'
      }
    }

    // if (req.query.passenger != null && req.query.passenger != 'all') {
    //   filter.passenger = req.query.passenger
    // }

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
    ]).then(async (value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }
        const result = await Promise.all(value[1].map(async x => ({...(JSON.parse(JSON.stringify(x))), employee: await Employee.findOne({ phone: x.passenger.phoneNumber, corporate: x.corporate})})))
        res.send({ data: result, count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Corporate Trip => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Corporate Trip => ' + error.toString())
    res.status(500).send(error)
  };
}

const scheduledTrips = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      corporate: req.params.id,
      schedule: { $ne: null }
    }

    if (req.query.status && req.query.status != null && req.query.status != 'all') {
      filter.status = {
        $regex: req.query.status, $options: 'i'
      }
    }

    // if (req.query.passenger != null && req.query.passenger != 'all') {
    //   filter.passenger = req.query.passenger
    // }

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
      logger.error('Corporate Trip => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Corporate Trip => ' + error.toString())
    res.status(500).send(error)
  };
}

const tripRequests = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      corporate: req.params.id
    }

    if (req.query.status && req.query.status != null && req.query.status != 'all') {
      filter.status = {
        $regex: req.query.status, $options: 'i'
      }
    }

    if (req.query.tripSearch != null) {
      filter.tripSearchId = req.query.tripSearch
    }

    // if (req.query.passenger != null && req.query.passenger != 'all') {
    //   filter.passenger = req.query.passenger
    // }

    if (req.query.dispatcher != null && req.query.dispatcher != 'all') {
      filter.dispatcher = req.query.dispatcher
    }

    if (req.query.from || req.query.to) { filter.createdAt = filterByTimeRange(req.query.from, req.query.to) }

    const trip = TripRequest.find(filter)
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

    trip.populate('driver').populate('passenger').populate('dispatcher').populate('vehicleType').populate('dispatcherWhoCancelled')
    // if (req.query.populate) {
    //   const populate = JSON.parse(req.query.populate)
    //   populate.forEach((e) => {
    //     trip.populate(e)
    //   })
    // }

    console.log("EXECUTING")
    console.log(filter)
    Promise.all([
      TripRequest.countDocuments(filter),
      trip.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }
        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('TripRequest =>' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('TripRequest =>' + error.toString())
    res.status(500).send(error)
  };

}

const tripSearches = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      corporate: req.params.id
    }

    if (req.query.status && req.query.status != null && req.query.status != 'all') {
      filter.status = {
        $regex: req.query.status, $options: 'i'
      }
    }

    // if (req.query.passenger != null && req.query.passenger != 'all') {
    //   filter.passenger = req.query.passenger
    // }

    if (req.query.dispatcher != null && req.query.dispatcher != 'all') {
      filter.dispatcher = req.query.dispatcher
    }

    if (req.query.from || req.query.to) { filter.createdAt = filterByTimeRange(req.query.from, req.query.to) }

    const trip = TripSearch.find(filter)
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
      TripSearch.countDocuments(filter),
      trip.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }
        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('TripSearch =>' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  };
}

const dashboard = async (req, res) => {
  const now = new Date()
  const start = now
  const end = now

  if (req.query.month) {
    start.setMonth(parseInt(req.query.month))
    end.setMonth(parseInt(req.query.month))
  }

  start.setDate(1)
  end.setDate(31)

  try {
    Promise.all([
      Ride.countDocuments({ corporate: req.params.id }),
      Ride.where({
        corporate: req.params.id,
        endTimestamp: { $gte: start },
        endTimestamp: { $lte: end }
      }),
      Ticket.countDocuments({ corporate: req.params.id })
    ]).then((value) => {
      if (value && value.length) {
        let total = 0
        let totalTrips = 0

        if (value[1] && value[1].length) {
          value[1].forEach((trip) => {
            if (trip.fare) {
              totalTrips += 1
              total += trip.fare
            }
          })
        }

        res.send({ totalTrips: value[0], monthlyTrip: totalTrips, tickets: value[2], monthlyCost: total })
      } else {
        res.status(500).send('Something went wrong!')
      }
    }).catch((error) => {
      logger.error('Corporate => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  }
}

const search = (req, res) => {
  try {
    Corporate.find({ name: { $regex: req.query.q ? req.query.q : '', $options: 'i' } }, (error, corporates) => {
      if (error) {
        logger.error('Corporate => ' + error.toString())
        res.status(500).send(error)
      }

      if (corporates) {
        res.send(corporates)
      }
    }).limit(10)
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  }
}

const tickets = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      // corporate: req.params.id
    }

    if (req.query.active != null && req.query.active != 'all') {
      filter.active = req.query.active
    }

    if (req.query.locked != null && req.query.locked != 'all') {
      filter.locked = req.query.locked
    }

    if (req.query.q != null) {
      filter.$or = [
        {
          code: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          'employee.name': {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }
      ]
    }

    // var tickets = Ticket.find(filter);
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

    const [results, ..._] = await Ticket
      .aggregate([
        {
          $match: { corporate: mongoose.Types.ObjectId(req.params.id) }
        },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employee'
          }
        },
        { $unwind: { path: '$employee' } },
        {
          $match: filter
        },
        {
          $sort: {
            createdAt: -1
          }
        },
        // https://docs.mongodb.com/manual/reference/operator/aggregation/facet/
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

    res.send({ ...(results.data.length ? results : { count: 0, data: [] }), nextPage, prevPage })
  } catch (error) {
    logger.error('corporate tickets => ' + error.toString())
    res.status(500).send(error)
  };

  //     tickets.sort({ createdAt: 'desc' });
  //     tickets.limit(limit);
  //     tickets.skip(skip);
  //     if (req.query.populate) {
  //         var populate = JSON.parse(req.query.populate)
  //         populate.forEach((e) => {
  //             tickets.populate(e);
  //         });
  //     }
  //     Promise.all([
  //         Ticket.countDocuments(filter),
  //         tickets.exec()
  //     ]).then(async (value) => {
  //         if (value) {
  //             if (((page * limit) <= value[0])) {
  //                 nextPage = page + 1;
  //             }

  //             res.send({ data: value[1], count: value[0], nextPage, prevPage });
  //         }
  //     }).catch((error) => {
  //         logger.error("Ticket => " + error.toString());
  //         res.status(500).send(error);
  //     });
  // } catch (error) {
  //     logger.error("Corporate tickets => " + error.toString());
  //     res.status(500).send(error);
  // }
}

const employees = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage

    const filter = {
      corporate: req.params.id
    }

    if (req.query.q != null) {
      filter.name =
        { $regex: req.query.q ? req.query.q : '', $options: 'i' }
    }

    if (req.query.active != null) {
      filter.active = req.query.active
    }

    const employees = Employee.find(filter)
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

    employees.sort({ createdAt: 'desc' })
    employees.limit(limit)
    employees.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        employees.populate(e)
      })
    }
    Promise.all([
      Employee.countDocuments(filter),
      employees.exec()
    ]).then(async (value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }

        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Employees => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Employees => ' + error.toString())
    res.status(500).send(error)
  };
}

const show = async (req, res) => {
  try {
    const corporate = await Corporate.findById(req.params.id)
    res.send(corporate)
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  };
}

const store = async (req, res) => {
  try {
    const data = req.body
    if (data.name && data.shortName) {
      Corporate.create({
        name: data.name,
        email: data.email,
        shortName: data.shortName,
        pricing: data.pricing,
      }, (error, corporate) => {
        if (error) {
          logger.error('Corporate => ' + error.toString())
          res.status(500).send(error)
        }
        if (corporate) {
          res.send({ corporate })
        }
      })
    } else {
      res.status(500).send('Invalid data')
    }
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  }
}

const pay = (req, res) => {
  try {
    if (req.params.id && req.body.amount && req.body.year && req.body.month) {
      const start = new Date(req.body.year, req.body.month, 1)
      const end = new Date(req.body.year, req.body.month + 1, 0)
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      CorporatePayment.create({
        corporate: req.params.id,
        startTimestamp: start,
        endTimestamp: end,
        amount: req.body.amount,
        month: monthNames[req.body.month]
      }, (error, payment) => {
        if (error) {
          logger.error('Corporate => ' + error.toString())
          res.status(500).send(error)
        }

        if (payment) {
          res.send(payment)
        }
      })
    } else {
      res.status(500).send('Invalid data')
    }
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
  try {
    const updatedCorporate = await Corporate.updateOne({ _id: req.params.id }, req.body)
    res.send(updatedCorporate)
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  }
}

const updatePricing = async (req, res) => {
  try {
    const updatedCorporate = await Corporate.updateOne({ _id: req.params.id }, { $set: { pricing: req.body } })
    res.send(updatedCorporate)
  } catch (error) {
    logger.error('Corporate => ' + error.toString())
    res.status(500).send(error)
  }
}

const exportCorporateTrips = (req, res) => {
  try {
    const filter = {
      corporate: req.params.id,
    }

    if (req.query.status != null && req.query.status != 'all') {
      filter.status = {
        $regex: req.query.status, $options: 'i'
      }
    }

    // if (req.query.driver != null && req.query.driver != 'all') {
    //   filter.driver = req.query.driver
    // }

    // if (req.query.passenger != null && req.query.passenger != 'all') {
    //   filter.passenger = req.query.passenger
    // }

    // if (req.query.dispatcher != null && req.query.dispatcher != 'all') {
    //   filter.dispatcher = req.query.dispatcher
    // }

    // console.log(req.query.passenger)
    filter.pickupTimestamp = filterByTimeRange(req.query.start, req.query.end)

    const trip = Ride.find(filter)

    trip.populate()
    trip.sort({ pickupTimestamp: 'desc' });

    ['driver', 'passenger', 'vehicleType', 'dispatcher', 'corporate', 'ticket'].forEach(model => trip.populate(model))

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
          status,
          corporate,
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
        fileName: 'generated-corporate-report.xls',
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

const remove = async (req, res) => {
  try {
    const deletedCorporate = await Corporate.remove({ _id: req.params.id })
    res.send(deletedCorporate)
  } catch (error) {
    res.status(500).send(error)
  }
}

module.exports = { index, show, retryTripSearch, restartTripSearch, cancelTripSearch, listOfCorporates, listOfEmployees, store, update, updatePricing, remove, trips, scheduledTrips, tripSearches, tripRequests, dashboard, search, pay, exportCorporateTrips, tickets, employees }
