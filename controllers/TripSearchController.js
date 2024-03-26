const Ride = require('../models/Ride')
const { request, json } = require('express')
const { send } = require('../services/emailService')
const { sendNotification } = require('../services/notificationService')
const { sendEmail, customerEmail } = require('../services/emailService')
const logger = require('../services/logger')
const SOS = require('../models/SOS')
const Setting = require('../models/Setting')
const Ticket = require('../models/Ticket')
const { updateWallet } = require('./DriverController')
const Vehicle = require('../models/Vehicle')
const TripSearch = require('../models/TripSearch')
const { getIO } = require('../sockets/io')
const { log } = require('../services/logger')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')

const { ObjectId } = require('mongoose').Types
const { emitToDriver, notifyDriver } = require('../sockets/utils/driver')
const { notifyPassenger, emitToPassenger } = require('../sockets/utils/passenger')
const { updateVehicle } = require('../sockets/utils/vehicle')
const passengerTasks = require('../jobs/passenger')

const TRIP_SEARCH_STATUSES = require('../constants/trip-search-statuses')
const TRIP_REQUEST_STATUSES = require('../constants/trip-request-statuses')
const { getTripSearch } = require('../sockets/utils/ride-search')
const TripRequest = require('../models/TripRequest')


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

const dataForHeatMap = async (req, res) => {
  try {
    const filter = {
      createdAt: filterByTimeRange(req.query.from, req.query.to) 
    }

    const data = await TripSearch.aggregate([
      { $match: filter },
      {
        $project: {
          _id : 0 ,
          lat: '$pickUpAddress.lat',
          long: '$pickUpAddress.long',
        }
      },
    ])

    res.status(200).send(data)
  } catch (err) {
    console.log(err)
  }
}

const show = async (req, res) => {
  try {
    const trip = await TripSearch.findById(req.params.id).populate('driver').populate('vehicle').populate('vehicleType').populate('dispatcher').populate('passenger').populate('ticket')
    res.send(trip)
  } catch (error) {
    logger.error('TripSearch => ' + error.toString())
    res.status(500).send(error)
  };
}

const store = async (req, res) => {
  try {
    const savedTrip = await TripSearch.create(req.body)
    res.send(savedTrip)
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
  try {
    const updatedTrip = await TripSearch.updateOne({ _id: req.params.id }, req.body)
    res.send(updatedTrip)
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  }
}

const remove = async (req, res) => {
  try {
    const deletedTrip = await TripSearch.findByIdAndDelete(req.params.id)
    res.send(deletedTrip)
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  }
}

const restart = async (req, res) => {
  try {
    const tripSearch = await TripSearch.findOne({
      status: { $ne: TRIP_SEARCH_STATUSES.IN_PROGRESS },
      _id: ObjectId(req.params.id)
    })

    if (tripSearch) {

      const newTripSearch = await TripSearch.create({
        active: true,
        passenger: tripSearch.passenger,
        requestedVehicles: [],
        dispatcher: res.locals.users ? res.locals.user._id : null,
        pickUpAddress: tripSearch.pickUpAddress,
        dropOffAddress: tripSearch.dropOffAddress,
        vehicleType: tripSearch.vehicleType,
        route: tripSearch.route,
        ticket: tripSearch.corporate ? tripSearch.ticket : null,
        note: tripSearch.note ? tripSearch.note : '',
        corporate: null, // TODO: add corporate
        schedule: tripSearch.schedule,
        bidAmount: tripSearch.bidAmount && tripSearch.type == "bid" ? tripSearch.bidAmount : null,
        type: tripSearch.type
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

const retry = async (req, res) => {
  try {
    const tripSearch = await TripSearch.findOne({
      status: {
        $in: [
          TRIP_SEARCH_STATUSES.NO_DRIVERS_FOUND,
          TRIP_SEARCH_STATUSES.CANCELLED,
        ]
      },
      _id: ObjectId(req.params.id)
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

const cancel = async (req, res) => {
  try {
    const tripSearch = await TripSearch.findOne({
      status: TRIP_SEARCH_STATUSES.IN_PROGRESS,
      _id: ObjectId(req.params.id)
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


const exportReport = (req, res) => {
  try {
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

    if (req.query.from || req.query.to) { filter.createdAt = filterByTimeRange(req.query.from, req.query.to) }

    const trip = TripSearch.find(filter)

    trip.sort({ createdAt: 'desc' });

    ['passenger', 'vehicleType', 'dispatcher'].forEach(model => trip.populate(model));

    trip.exec().then((tripRecords) => {
      const reportData = [
        [
          'Dispatcher',
          'Scheduled',
          'Passenger Name',
          'Started At',
          'Pick / Drop Address',
          'Vehicle Type',
          'Status'
        ].join('\t'),
        ...tripRecords.map(({
          dispatcher,
          schedule,
          passenger,
          pickUpAddress,
          dropOffAddress,
          vehicleType,
          status,
          createdAt,
        }) => [
          dispatcher ? dispatcher.firstName +
            ' ' +
            dispatcher.lastName
            : ' - ',
          schedule ? 'Scheduled' : 'Now',
          passenger ? passenger.firstName + ' ' + passenger.lastName
            : 'Unknown',
          createdAt,
          [
            pickUpAddress.name,
            dropOffAddress.name
          ].join(' -> '),

          vehicleType ? vehicleType.name : '-',

          status

        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report-trip-searches.xls',
        fileData: reportData
      })
    }).catch((error) => {
      logger.error('TripSearch =>' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('TripSearch =>' + error.toString())
    res.status(500).send(error)
  };
}

module.exports = { index, show, store, dataForHeatMap, update, remove, cancel, retry, restart, exportReport }
