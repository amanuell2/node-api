const Setting = require('../models/Setting')
const VehicleType = require('../models/VehicleType')
const Driver = require('../models/Driver')
const User = require('../models/User')
const Vehicle = require('../models/Vehicle')
const Ride = require('../models/Ride')
const { default: Axios } = require('axios')
const Rent = require('../models/Rent')
const logger = require('../services/logger')
const DriverLocalization = require('../models/DriverLocalization')
const PassengerLocalization = require('../models/PassengerLocalizations')

const TRIP_STATUS = require('../constants/trip-statuses')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')

const getSettingsAndVehicleModels = async (req, res) => {
    Promise.all([
      Setting.findOne({}, "androidPassengerVersion iosPassengerVersion leastAndroidPassengerVersion surgeTimeFrom surgeTimeUpto leastIosPassengerVersion passengerPlaystoreLink passengerAppstoreLink discount contactNumber promoAmount promoRate promoTripCount mapKey"),
      VehicleType.find({ active: true }).sort({ order: 'asc' })
    ]).then(value => {
      res.json({
        setting: value[0],
        vehicleTypes: value[1]
      })
    }).catch((error) => {
      logger.error('Core => ' + error.toString())
      res.status(500).send(error)
    })
  }
  
const localizationLanguages = async (req, res) => {
  function onlyUnique(value, index, self) {
    return self.findIndex(v => v.name === value.name) === index;
  }

  try {
    const driverLocalizations = await DriverLocalization.find({}, 'name');
    const passengerLocalizations = await PassengerLocalization.find({}, 'name');

    res.send([...driverLocalizations, ...passengerLocalizations].filter(onlyUnique))
  } catch (error) {
      logger.error('Localization => ' + error.toString())
      res.status(500).send(error)        
  }
}

const createLocalization = async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(422).send("name is required")
    } else {
      try {
        await PassengerLocalization.create({
          data: (await PassengerLocalization.findOne({name: "english"}))._doc.data,
          name: req.body.name,
        })
        await DriverLocalization.create({
          data: (await DriverLocalization.findOne({name: "english"}))._doc.data,
          name: req.body.name,
        })
        return res.status(201).send("localization created successfully")
      } catch(err) {
        if (err.name === "MongoError" && err.code === 11000) {
          return res.status(409).send("name must be unique")
        }
        logger.error('Localization => ' + err.toString())
        return res.status(500).send(err)
      }

    }
  } catch (error) {
      logger.error('Localization => ' + error.toString())
      res.status(500).send(error)        
  }
}

const getPassengerSettings = async (req, res) => {
  Setting.findOne({}, "androidPassengerVersion iosPassengerVersion leastAndroidPassengerVersion surgeTimeFrom surgeTimeUpto leastIosPassengerVersion passengerPlaystoreLink passengerAppstoreLink discount contactNumber promoAmount promoRate promoTripCount mapKey")
    .then(value => {
      res.json(value)
    }).catch((error) => {
      logger.error('Core => ' + error.toString())
      res.status(500).send(error)
    })
}

const getPassengerVehicleModels = async (req, res) => {
  let city = req.query.city
  
  let filter = { active: true }

  if (city) {
    filter.city = {$regex: city, $options: 'i'}
  }
  
  VehicleType.find(filter).sort({ order: 'asc' })
    .then(value => {
      res.json(value)
    }).catch((error) => {
      logger.error('Core => ' + error.toString())
      res.status(500).send(error)
    })
}

const dashboard = async (req, res) => {
  const filter = {}
  if (req.query.from || req.query.to) { filter.createdAt = filterByTimeRange(req.query.from, req.query.to) }

  Promise.all([
    Driver.countDocuments({ isBanned: false, ...filter }),
    User.countDocuments({...filter}),
    VehicleType.countDocuments({...filter}),
    Vehicle.countDocuments({ online: true, ...filter }),
    Ride.countDocuments({...filter}),
    Driver.countDocuments({ approved: true, isBanned: false, ...filter }),
    Ride.countDocuments({ status: TRIP_STATUS.CANCELLED, ...filter }),
    Ride.countDocuments({ status: TRIP_STATUS.COMPLETED, ...filter }),
    Ride.countDocuments({ status: TRIP_STATUS.ACCEPTED, ...filter }),
    Ride.countDocuments({ status: TRIP_STATUS.ARRIVED, ...filter }),
    Ride.countDocuments({ status: TRIP_STATUS.STARTED, ...filter }),
    Vehicle.countDocuments({ active: true }),
    Vehicle.countDocuments({ online: false, active: true, inActiveTrip: false }),
    Vehicle.countDocuments({ inActiveTrip: true })
  ]).then(value => {
    res.json({
      totalDrivers: value[0],
      totalUsers: value[1],
      totalVehicleTypes: value[2],
      totalActiveFleets: value[3],
      totalTrips: value[4],
      numberOfApprovedDriver: value[5],
      totalCanceledTrips: value[6],
      totalCompletedTrips: value[7],
      totalRunningTrips: value[8] + value[9] + value[10],
      activeVehicles: value[11],
      activeButOfflineVehicles: value[12],
      inActiveTrip: value[13],
    })
  }).catch((error) => {
    logger.error('Core => ' + error.toString())
    res.status(500).send(error)
  })
}

const route = (req, res) => {
  try {
    if (req && req.body && req.body.dropOffAddress && req.body.pickUpAddress) {
      Axios.get('https://api.mapbox.com/directions/v5/mapbox/driving/' + req.body.pickUpAddress.long + ',' + req.body.pickUpAddress.lat + ';' + req.body.dropOffAddress.long + ',' + req.body.dropOffAddress.lat + '?radiuses=unlimited;&geometries=geojson&access_token=pk.eyJ1IjoiYWplYnVzaGlsaWZ0IiwiYSI6ImNsY2lyMHBjODBidzUzb210ajFpZDhoZnUifQ.0vl0bDeP9tIpf5vmo49asw').then((route) => {
        if (route && route.data && route.data.routes && route.data.routes[0] && route.data.routes[0].geometry && route.data.routes[0].geometry.coordinates) {
          res.send({ coordinates: route.data.routes[0].geometry.coordinates, distance: route.data.routes[0].distance, duration: route.data.routes[0].duration })
        } else {
          res.sendStatus(500)
        }
      }).catch(error => {
        logger.error('Core => ' + error.toString())
        res.status(500).send(error)
      })
    } else {
      res.status(500).send('invalid data')
    }
  } catch (error) {
    logger.error('Core => ' + error.toString())
    res.status(500).send(error)
  }
}

const godview = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      isBanned: {
        $ne: true
      }
    }, 'online modelName color position inActiveTrip').populate('driver', '_id fullName approved rating')
    res.send(vehicles)
  } catch (error) {
    res.status(500).send(error)
    logger.error('Core => ' + error.toString())
  }
}

const finance = (req, res) => {
  try {
    const filter = {}

    let normalTripsFare = 0
    let corporateTripsFare = 0
    let normalTripsNet = 0
    let corporateTripsNet = 0
    let normalTripsTax = 0
    let corporateTripsTax = 0

    let rentFare = 0
    let rentNet = 0
    let rentTax = 0

    filter.pickupTimestamp = filterByTimeRange(req.query.from, req.query.to)

    if (req.query.driver != null && req.query.driver != 'all') {
      filter.driver = req.query.driver
    }

    Promise.all([
      Ride.find(filter),
      Rent.find(filter)
    ]).then((value) => {
      if (value[0]) {
        value[0].forEach((ride) => {
          if (ride.type == 'corporate') {
            corporateTripsFare += ride.fare
            corporateTripsNet += ride.net
            corporateTripsTax += ride.tax
          } else {
            normalTripsFare += ride.fare
            normalTripsNet += ride.net
            normalTripsTax += ride.tax
          }
        })
      }

      if (value[1]) {
        value[1].forEach((rent) => {
          rentFare += rent.fare
          rentNet += rent.net
          rentTax += rent.tax
        })
      }

      res.send({
        normalTripsFare,
        normalTripsNet,
        normalTripsTax,
        corporateTripsFare,
        corporateTripsNet,
        corporateTripsTax,
        rentFare,
        rentNet,
        rentTax
      })
    }).catch((error) => {
      res.status(500).send(error)
      logger.error('Core => ' + error.toString())
    })
  } catch (error) {
    res.status(500).send(error)
    logger.error('Core => ' + error.toString())
  }
}

const exportFinancialReport = (req, res) => {
  try {
    const filter = {}

    let normalTripsFare = 0
    let corporateTripsFare = 0
    let normalTripsNet = 0
    let corporateTripsNet = 0
    let normalTripsTax = 0
    let corporateTripsTax = 0

    let rentFare = 0
    let rentNet = 0
    let rentTax = 0

    filter.pickupTimestamp = filterByTimeRange(req.query.from, req.query.to)

    if (req.query.driver != null && req.query.driver != 'all') {
      filter.driver = req.query.driver
    }

    Promise.all([
      Ride.find(filter),
      Rent.find(filter)
    ]).then((value) => {
      if (value[0]) {
        value[0].forEach((ride) => {
          if (ride.type == 'corporate') {
            corporateTripsFare += ride.fare
            corporateTripsNet += ride.net
            corporateTripsTax += ride.tax
          } else {
            normalTripsFare += ride.fare
            normalTripsNet += ride.net
            normalTripsTax += ride.tax
          }
        })
      }

      if (value[1]) {
        value[1].forEach((rent) => {
          rentFare += rent.fare
          rentNet += rent.net
          rentTax += rent.tax
        })
      }

      const reportData = [
        [
          'Normal Trips Fare',
          'Normal Trips Net',
          'Normal Trips Tax',
          'Corporate Trips Fare',
          'Corporate Trips Net',
          'Corporate Trips Tax',
          'Rent Fare',
          'Rent Net',
          'Rent Tax',
          'Total Fare',
          'Total Net',
          'Total Tax'
        ].join('\t'),
        [
          normalTripsFare,
          normalTripsNet,
          normalTripsTax,
          corporateTripsFare,
          corporateTripsNet,
          corporateTripsTax,
          rentFare,
          rentNet,
          rentTax,
          (normalTripsFare + corporateTripsFare + rentFare).toFixed(2),
          (normalTripsNet + corporateTripsNet + rentNet).toFixed(2),
          (normalTripsTax + corporateTripsTax + rentTax).toFixed(2)
        ].join('\t')
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report-financial.xls',
        fileData: reportData
      })
    }).catch((error) => {
      res.status(500).send(error)
      logger.error('Core Financial Report => ' + error.toString())
    })
  } catch (error) {
    res.status(500).send(error)
    logger.error('Core Financial Report => ' + error.toString())
  }
}

const date = (req, res) => {
  res.send(new Date())
}

module.exports = { getSettingsAndVehicleModels, getPassengerSettings, getPassengerVehicleModels, dashboard, route, createLocalization, localizationLanguages, godview, finance, date, exportFinancialReport }