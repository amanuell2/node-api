const Ride = require('../models/Ride')
const { request, json } = require('express')
const { send } = require('../services/emailService')
const { sendNotification } = require('../services/notificationService')
const Rent = require('../models/Rent')
const logger = require('../services/logger')
const { filterByTimeRange } = require('../utils/date-filter')
const { generateAndSendReport } = require('../utils/reports')

const index = (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
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

    // if (req.query.start != null && req.query.start != 'all' && req.query.end != null && req.query.end != 'all') {
    //   filter.$and = [{ pickupTimestamp: { $gte: new Date(req.query.start) } }, { pickupTimestamp: { $lte: new Date(req.query.end) } }]
    // } else if (req.query.end != null && req.query.end != 'all') {
    //   filter.pickupTimestamp = { $lte: new Date(req.query.end) }
    // } else if (req.query.start != null && req.query.start != 'all') {
    //   filter.pickupTimestamp = { $gte: new Date(req.query.start) }
    // }

    filter.createdAt = filterByTimeRange(req.query.from, req.query.to)

    const rent = Rent.find(filter)
    
    for (linkedModel of ['passenger', 'driver', 'vehicletype', 'vehicle']) {
      rent.populate(linkedModel)
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

    rent.sort({ createdAt: 'desc' })
    rent.limit(limit)
    rent.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        rent.populate(e)
      })
    }
    Promise.all([
      Rent.countDocuments(filter),
      rent.exec()
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }
        res.send({ data: value[1], count: value[0], nextPage, prevPage })
      }
    }).catch((error) => {
      logger.error('Rent => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Rent => ' + error.toString())
    res.status(500).send(error)
  };
}

const show = async (req, res) => {
  try {
    const rent = await Rent.findById(req.params.id).populate('driver').populate('vehicle').populate('vehicleType').populate('dispatcher').populate('passenger')
    res.send(rent)
  } catch (error) {
    logger.error('Rent => ' + error.toString())
    res.status(500).send(error)
  };
}

const store = async (req, res) => {
  try {
    const savedRent = await Rent.create(req.body)
    res.send(savedRent)
  } catch (error) {
    logger.error('Rent => ' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
  try {
    const updatedRent = await Rent.updateOne({ _id: req.params.id }, req.body)
    res.send(updatedRent)
  } catch (error) {
    logger.error('Rent => ' + error.toString())
    res.status(500).send(error)
  }
}

const remove = async (req, res) => {
  try {
    const deletedRent = await Rent.findByIdAndDelete(req.params.id)
    res.send(deletedRent)
  } catch (error) {
    logger.error('Rent => ' + error.toString())
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

    const rents = Rent.find(filter)

    rents.sort({ pickupTimestamp: 'desc' });

    ['driver', 'passenger', 'vehicleType', 'dispatcher'].forEach(model => rents.populate(model))

    rents.exec().then((rentsRecords) => {
      const reportData = [
        [
          'Dispatcher',
          'Passenger Name',
          'Driver Name',
          'Pickup / End Time',
          'Pickup Address',
          'Fare',
          'Vehicle Type',
          'Status'
        ].join('\t'),
        ...rentsRecords.map(({
          dispatcher,
          passenger,
          driver,
          startTimestamp,
          endTimestamp,
          pickUpAddress,
          vehicleType,
          fare,
          status
        }) => [
          dispatcher ? dispatcher.firstName +
            ' ' +
            dispatcher.lastName
            : ' - ',
          passenger ? passenger.firstName + ' ' + passenger.lastName
            : 'Unknown',

          driver
            ? driver.firstName + ' ' + driver.lastName 
            : 'Unknown',

          [
            startTimestamp || '-',

            endTimestamp || '-'
          ].join(' -> '),

          [
            pickUpAddress.name
          ].join(' -> '),

          fare.toFixed(2),

          vehicleType ? vehicleType.name : '-',

          status

        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report-rents.xls',
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

module.exports = { index, show, store, update, remove, exportReport }
