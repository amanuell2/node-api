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
const TripRequest = require('../models/TripRequest')
const { getIO } = require('../sockets/io')
const { log } = require('../services/logger')

const { ObjectId } = require('mongoose').Types

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')
const { emitToDriver, notifyDriver } = require('../sockets/utils/driver')
const { notifyPassenger, emitToPassenger } = require('../sockets/utils/passenger')
const { updateVehicle } = require('../sockets/utils/vehicle')
const passengerTasks = require('../jobs/passenger')

const TRIP_REQUEST_STATUSES = require('../constants/trip-request-statuses')
const { getTripSearch } = require('../sockets/utils/ride-search')

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

    if (req.query.tripSearch != null) {
      filter.tripSearchId = req.query.tripSearch
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

const show = async (req, res) => {
  try {
    const trip = await TripRequest.findById(req.params.id).populate('driver').populate('vehicle').populate('vehicleType').populate('dispatcher').populate('passenger').populate('ticket')
    res.send(trip)
  } catch (error) {
    logger.error('TripRequest => ' + error.toString())
    res.status(500).send(error)
  };
}

const store = async (req, res) => {
  try {
    const savedTrip = await TripRequest.create(req.body)
    res.send(savedTrip)
  } catch (error) {
    logger.error('TripRequest =>' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
  try {
    const updatedTrip = await TripRequest.updateOne({ _id: req.params.id }, req.body)
    res.send(updatedTrip)
  } catch (error) {
    logger.error('TripRequest =>' + error.toString())
    res.status(500).send(error)
  }
}

const remove = async (req, res) => {
  try {
    const deletedTrip = await TripRequest.deleteOne({ _id: req.params.id })
    res.send(deletedTrip)
  } catch (error) {
    logger.error('TripRequest =>' + error.toString())
    res.status(500).send(error)
  }
}

const cancel = async (req, res) => {
  try {
    const tripRequest = await TripRequest.findOne({
      status: TRIP_REQUEST_STATUSES.IN_REQUEST,
      _id: ObjectId(req.params.id)
    })

    if (tripRequest) {
        tripRequest.status = TRIP_REQUEST_STATUSES.CANCELLED
        tripRequest.cancelledBy = 'Dispatcher'
        tripRequest.cancelledReason = req.body.reason ? req.body.reason : ''
        tripRequest.active = false
        tripRequest.dispatcherWhoCancelled = res.locals.user ? res.locals.user._id : null
        await tripRequest.save()
        
        console.log(tripRequest)
        await updateVehicle(tripRequest.vehicle)({ online: true,
          // tripRequestId: null
        })

        const task = await getTripSearch(tripRequest.tripSearchId)
        const setting = await Setting.findOne()

        await passengerTasks.skipSearchingForRides(task, `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds` )
        
        await emitToDriver(tripRequest.driver)('requestCanceled')
        await emitToPassenger(tripRequest.passenger)('requestCanceled')        
        await notifyDriver(tripRequest.driver)({ title: 'Request Canceled', body: 'Request has been cancelled' })
        await notifyPassenger(tripRequest.passenger)({ title: 'Request Canceled', body: 'Request has been cancelled' })

        res.send(tripRequest)
    } else {
      res.status(404).send('request not found or is not active')
    }
  } catch (error) {
    logger.error('TripRequest =>' + error.toString())
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
    filter.createdAt = filterByTimeRange(req.query.start, req.query.end)

    const trip = TripRequest.find(filter)

    trip.populate()
    trip.sort({ pickupTimestamp: 'desc' });

    ['driver', 'passenger', 'vehicleType', 'dispatcher', 'dispatcherWhoCancelled'].forEach(model => trip.populate(model))

    trip.exec().then((tripRecords) => {
      const reportData = [
        [
          'Dispatcher',
          'Scheduled',
          'Passenger Name',
          'Driver Name',
          'Started At',
          'Pick / Drop Address',
          'Vehicle Type',
          'Status',
          'Cancelled By'
        ].join('\t'),
        ...tripRecords.map(({
          dispatcher,
          schedule,
          passenger,
          driver,
          createdAt,
          pickUpAddress,
          dropOffAddress,
          vehicleType,
          status,
          dispatcherWhoCancelled
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

          createdAt,

          [
            pickUpAddress.name,
            dropOffAddress.name
          ].join(' -> '),

          vehicleType ? vehicleType.name : '-',

          status,
          dispatcherWhoCancelled ? dispatcherWhoCancelled.firstName +
            ' ' +
            dispatcherWhoCancelled.lastName : ' - '
        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report-trip-requests.xls',
        fileData: reportData
      })
    }).catch((error) => {
      logger.error('TripRequest =>' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('TripRequest =>' + error.toString())
    res.status(500).send(error)
  };
}

module.exports = { index, show, store, update, remove, cancel, exportReport }
