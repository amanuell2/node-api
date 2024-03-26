const Pool = require('../../../models/Pool')
const Ride = require('../../../models/Ride')
const Vehicle = require('../../../models/Vehicle')
const DriverStat = require('../../../models/DriverStat')
const Setting = require('../../../models/Setting')
const { ObjectId } = require('mongoose').Types
const { sanitizeInputs } = require('../../utils/core')
const { getTrip, updateTrip } = require('../../utils/trip')
const { getRent, updateRent } = require('../../utils/rent')
const { updateVehicle } = require('../../utils/vehicle')
const { emitToPassenger } = require('../../utils/passenger')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const RENT_STATUS = require('../../../constants/rent-statuses')
const POOL_STATUS = require('../../../constants/pool-statuses')

const schema = {
  type: "object",
  properties: {
    lat: { type: "number" },
    long: { type: "number" },
  },
  required: ["lat", "long"],
  // additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    // await sanitizeInputs(schema, data)
    try {
      if (vehicle && data.long && data.lat) {
        await updateVehicle(vehicle._id)({
          timestamp: new Date(),
          position: {
            type: 'Point',
            coordinates: [
              data.long,
              data.lat
            ]
          },
          lastPingTimestamp: new Date()
        })
      }

      // console.log(driver.firstName + ' ' + driver.lastName + ' - location updated', data)
    } catch (error) {
      console.log({ error })
    }

    const setting = await Setting.findOne()
    try {
      const dows = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
      ]

      const dow = dows[new Date().getDay()]
      const stat = await DriverStat.findOne({ driver: ObjectId(driver._id), vehicle: ObjectId(vehicle._id) })

      if (stat) {
        // if (stat[dow].online)
        await DriverStat.updateOne({
          driver: ObjectId(driver._id), vehicle: ObjectId(vehicle._id)
        }, {
          $inc: {
            [dow + '.onlineHours']: setting.locationUpdateInterval,
          },
          $set: {
            [dow + '.lastUpdatedAt']: new Date(),
            ...Object.fromEntries(dows.slice(new Date().getDay() + 1).map((x) => ([x,{onlineHours: 0, lastUpdatedAt: new Date()}])))
          }
        })
      } else {
        await DriverStat.create({
          driver: ObjectId(driver._id), vehicle: ObjectId(vehicle._id),
          [dow + '.onlineHours']: setting.locationUpdateInterval,
          [dow + '.lastUpdatedAt']: new Date()
        })
      }
    }
    catch (error) {
      console.log(error)
    }

    if (data.tripId) {
      const trip = await getTrip(data.tripId)
      if (trip) {
        emitToPassenger(trip.passenger)('driverLocation', { lat: data.lat, long: data.long })
        if (trip.status === TRIP_STATUS.STARTED) {
          trip.path.push([data.long, data.lat])
          await trip.save()
          // addTrip(trip)
          try {
            await updateTrip(data.tripId)({ path: trip.path })
            // const updateRide = await Ride.updateOne({ _id: data.tripId }, { path: trip.path })
          } catch (error) {
            console.log({ error })
          }
        }
      }
    } else if (data.rentId) {
      try {
        const rent = await getRent(data.rentId)
        if (rent && rent.status === RENT_STATUS.ACCEPTED) {
          emitToPassenger(rent.passenger)('driverLocation', { lat: data.lat, long: data.long })
        }
      } catch (error) {
        console.log(error)
      }
    } else if (data.poolId) {
      const pool = await Pool.findOne({
        _id: ObjectId(data.poolId),
        active: true
      }).populate('trips', 'passenger')

      if (pool) {
        for (const { passenger } of pool.trips) {
          await emitToPassenger(passenger)('driverLocation', { lat: data.lat, long: data.long })
        }
        if (pool.active) {
          pool.position.coordinates = [data.long, data.lat]
          pool.distance = data.distance
          pool.path.push([data.long, data.lat])
          try {
            await pool.save()
          } catch (error) {
            console.log({ error })
          }
        }
      }
    }
  } catch (error) {
    console.log({ error })
  }

}

