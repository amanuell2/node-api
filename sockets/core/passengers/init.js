const passengerTasks = require('../../../jobs/passenger')

const { getPassengerRequest } = require('../../utils/request')
const { sanitizeInputs } = require('../../utils/core')
const { updatePassenger } = require('../../utils/passenger')

const { ObjectId } = require('mongoose').Types

const Ride = require('../../../models/Ride')
const Pool = require('../../../models/Pool')
const Rent = require('../../../models/Rent')

const { getNearbyDrivers } = require('../../core')

const TRIP_SEARCH_STATUS = require('../../../constants/trip-search-statuses')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const POOL_STATUS = require('../../../constants/pool-statuses')
const { getActiveRequestByPassenger } = require('../../utils/trip-request')
const { getActivePoolRequestByPassenger } = require('../../utils/pool-request')

const activityLogger = require('../../../services/activity-logger')
const Setting = require('../../../models/Setting')
const { getActiveRentRequestByPassenger } = require('../../utils/rent-request')
const TripSearch = require('../../../models/TripSearch')

const schema = {
  type: "object",
  properties: {
    fcm: { type: "string" },
    location: { type: "object" }, // TODO: make sure this includes lat and long
  },
  required: ['fcm', 'location'],
  additionalProperties: false
}

// TODO: these values will be moved to db
const NEARBY_DRIVERS_FETCHING_INTERVAL = 10 // second
const NEARBY_DRIVERS_LIMIT = 20

module.exports = async (passengerInfo, passenger, socket) => {

  try {
    // await sanitizeInputs(schema, passengerInfo)

    await passengerTasks.stopFetchNearByDrivers({ id: passenger._id })

    ///////////////
    // var d = new Date();
    // d.setMinutes(d.getMinutes() - 40);
    
    // const activeTripSearchingTask = await TripSearch.find({
    //   passenger: ObjectId(passenger._id),
    //   active: true,
    //   createdAt: { $lt: d }
    // })

    // for (const task of activeTripSearchingTask) {
    //   task.status = "CANCELLED"
    //   task.active = false
      
    //   await task.save()
    //   if (!task.dispatcher)
    //     await passengerTasks.stopSearchingForRides(task) 
    // }

    
    ///////////////
    
    // await activityLogger.logActivity(activityLogger.PASSENGER_HAS_CONNECTED)({ passenger })
    await updatePassenger(passenger._id)({ socketId: socket.id, fcm: passengerInfo.fcm, position: passengerInfo.location })
    
    await passengerTasks.fetchNearByDrivers({ id: passenger._id, location: passengerInfo.location }, `${NEARBY_DRIVERS_FETCHING_INTERVAL} seconds`)
    
    const request = await getActiveRequestByPassenger(passenger._id)
    const poolRequest = await getActivePoolRequestByPassenger(passenger._id)

    // console.log(await redis.get(`passenger-info:${passenger._id}`))
    // await redis.set(`passenger-info:${id}`, {
    //     id: passengerInfo.id,
    //     fcm: passengerInfo.fcm,
    //     location: passengerInfo.location,
    // })

    // id = passengerInfo.id;
    // location = passengerInfo.location;
    // fcm = passengerInfo.fcm;
    // started = true; 

    if (passenger && passenger.inActivePool && passenger.poolId) {
      const pool = await Pool.findOne({ _id: ObjectId(passenger.poolId) }).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')
      if (pool.status === POOL_STATUS.STARTED) {
        const ride = await Ride.findOne({ active: true, passenger: passenger._id }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
        socket.emit('trip', ride)
      } else if (pool.status === POOL_STATUS.CREATED) {
        socket.emit('pool', pool)
      } else if (pool.status === POOL_STATUS.CANCELLED) {
        await updatePassenger(passenger._id, socket)({ inActivePool: false, poolId: null })
        socket.emit('pool', pool)
      } else {
        await updatePassenger(passenger._id, socket)({ inActivePool: false, poolId: null })
        const nearbyDrivers = await getNearbyDrivers({ location: passengerInfo.location, distance: 100, limit: NEARBY_DRIVERS_LIMIT })
        socket.emit('nearDrivers', nearbyDrivers)
      }
    } else {
      const rideOrdered = Ride.findOne({
        active: true,
        orderedBy: ObjectId(passenger._id),
        status: {
          $in: [
            TRIP_STATUS.ACCEPTED,
            TRIP_STATUS.ARRIVED,
          ]
        }
      }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')
      const ride = Ride.findOne({ active: true, passenger: passenger._id }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

      const rent = Rent.findOne({ active: true, passenger: passenger._id }).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

      const rentRequest = await getActiveRentRequestByPassenger(passenger._id)

      const [rideRes, rideOrderedRes, rentRes, requestRes, rentRequestResult, poolRequestResult] = await Promise.all([ride, rideOrdered, rent, request, rentRequest, poolRequest])
      if(poolRequestResult) {
        socket.emit('request', {
          ...poolRequestResult._doc,
          pool: true
        })
      } else if (rideOrderedRes) {
        socket.emit('trip', rideOrderedRes)
      } else if (rideRes) {
        socket.emit('trip', rideRes)
      } else if (rentRes && rentRes.status !== 'STARTED') { // TODO: update the status with rent status constant
        socket.emit('rent', rentRes)
      } else if (requestRes) {
        socket.emit('request', requestRes)
      } else if (rentRequestResult) {
        socket.emit('rentRequest', rentRequestResult)
      } else {
        socket.emit('online')
      }

      const setting = await Setting.findOne({}, "searchRadius")
      const nearbyDrivers = await getNearbyDrivers({ location: passengerInfo.location, distance: setting.searchRadius ? setting.searchRadius * 1000 : 10000, limit: NEARBY_DRIVERS_LIMIT })
      socket.emit('nearDrivers', JSON.parse(nearbyDrivers).map(vehicle => {
        return {
          position: {
            long: vehicle.position.coordinates[0],
            lat: vehicle.position.coordinates[1],
          },
          _id: vehicle._id
        }
      }))
    }
  } catch (error) {
    console.log(error)
  }
}