const Pool = require('../../../models/Pool')
const {ObjectId} = require('mongoose').Types
const Trip = require('../../../models/Ride')
const User = require('../../../models/User')
const Promo = require('../../../models/Promo')
const Driver = require('../../../models/Driver')
const Setting = require('../../../models/Setting')
const { updateWallet, update } = require('../../../controllers/DriverController')
const { customerEmail, sendEmail } = require('../../../services/emailService')
const Incentive = require('../../../models/Incentive')
const { emitToPassenger, notifyPassenger, updatePassenger } = require('../../utils/passenger')
const { sanitizeInputs } = require('../../utils/core')
const activityLogger = require('../../../services/activity-logger')
const { makeRequest } = require('../../../services/axios')
const mongoose = require('mongoose')
const { updateTrip } = require("../../utils/trip")
const { updatePool } = require("../../utils/pool")

const POOL_STATUS = require('../../../constants/pool-statuses')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const { updateVehicle } = require('../../utils/vehicle')

const schema = {
  type: "object",
  properties: {
    tripId: { type: "string" },
    poolId: { type: "string" },
    totalDistance: { type: "number" }
  },
  required: ["tripId", "totalDistance"],
  additionalProperties: false
}

module.exports = async (data, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, data)

    let pool = await Pool.findOne({ _id: ObjectId(data.poolId), active: true }).populate('vehicle').populate('vehicleType').populate('driver').populate('trips').populate('trips')

    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'pool does not exist'
      })
      return
    }

    if (pool.driver._id != driver._id) {
      return socket.emit('error', {
        type: 'pool',
        message: "you are not authorized."
      })
    }

    const poolTrips = await Trip.find({
      pool: data.poolId,
      status: TRIP_STATUS.STARTED
    })

    const distanceCovered = data.totalDistance - pool.distanceCovered > 0 ? data.totalDistance - pool.distanceCovered : 0;
    const poolTripDistanceFareSoFar = (distanceCovered * pool.vehicleType.pricePerKM) / (poolTrips.length ? poolTrips.length : 1);

    console.log("DISTANCE:", distanceCovered)
    console.log("DISTANCE FARE:", poolTripDistanceFareSoFar)

    for (const poolTrip of poolTrips) {
      await updatePool(data.poolId)({ distanceCovered: data.totalDistance })
      await updateTrip(poolTrip._id)({fare: poolTrip.fare + poolTripDistanceFareSoFar})
    }

    const tripToBeEnded = await Trip.findById(data.tripId).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

    // const tripToBeEnded = pool.trips.find((t) => {
    //     return t.passenger == trip.passengerId
    // })

    if (!tripToBeEnded) {
      socket.emit('error', {
        type: 'pool',
        message: 'no pool trip found to terminate'
      })
      return
    }

    if (!pool) {
      socket.emit('error', {
        type: 'pool',
        message: 'pool does not exist'
      })
      return
    }

    const setting = await Setting.findOne()

    
    if (pool.driver._id != driver._id) {
      return socket.emit('error', {
        type: 'pool',
        message: "you are not authorized."
      })
    }


    if (tripToBeEnded.pool != data.poolId) {
      return socket.emit('error', {
        type: "pool",
        message: "the trip specified does not belong to the pool"
      })
    }

    if (tripToBeEnded.status !== TRIP_STATUS.STARTED) {
      socket.emit('error', {
        type: 'pool',
        message: 'trip is not active. unable to terminate it.'
      })
      return
    }


    const date = new Date()
    const tsts = new Date(tripToBeEnded.pickupTimestamp)
    // const durationInMinute = ((date.getTime() - tsts.getTime()) / 1000) / 60

    var estimatedDuration = tripToBeEnded.route.duration // in seconds
    let actualDuration = (date.getTime() - tsts.getTime()) / 1000 // in seconds

    let durationIncludedInBilling = actualDuration > estimatedDuration ? (actualDuration - estimatedDuration) / 60 : 0


    const fare = tripToBeEnded.fare + (pool.vehicleType.baseFare / pool.trips.filter(t => t.status === TRIP_STATUS.STARTED || t.status === TRIP_STATUS.COMPLETED).length) + (durationIncludedInBilling * pool.vehicleType.pricePerMin)
    const companyCut = (fare * (setting.defaultRoadPickupCommission / 100))
    // payToDriver = discount;
    const payToDriver = fare - companyCut
    const tax = companyCut - (companyCut / ((setting.tax / 100) + 1))
    const net = ((fare * (setting.defaultRoadPickupCommission / 100))) - ((tax < 0) ? 0 : tax)
    const cutFromDriver = (-(fare * (setting.defaultRoadPickupCommission / 100)))

    const completedTripsOnPool = pool.trips.filter(t => t.status === TRIP_STATUS.COMPLETED)
    const activeTripsOnPoolCount = pool.trips.filter(t => t.status === TRIP_STATUS.STARTED).length
    console.log('CURRENTLY ACTIVE TRIPS:', activeTripsOnPoolCount)
    console.log('COMPLETED TRIPS:', completedTripsOnPool.length)
    tripToBeEnded.totalDistance = data.totalDistance
    tripToBeEnded.discount = 0
    tripToBeEnded.surge = false
    tripToBeEnded.companyCut = companyCut
    tripToBeEnded.dropOffAddress = data.dropOffAddress
    tripToBeEnded.tax = tax
    // tripToBeEnded.fare = fare / activeTripsOnPool;
    // tripToBeEnded.fare = (fare - completedTripsOnPool.map(x => x.fare).reduce((p, c) => p + c, 0)) / activeTripsOnPoolCount
    tripToBeEnded.fare = fare
    tripToBeEnded.status = TRIP_STATUS.COMPLETED
    tripToBeEnded.payToDriver = payToDriver
    tripToBeEnded.net = net
    tripToBeEnded.endTimestamp = date
    tripToBeEnded.active = false

    tripToBeEnded.path = pool.path
    await tripToBeEnded.save()
    // addTrip(res);

    await updatePassenger(tripToBeEnded.passenger._id)({ inActivePool: false })

    // TODO: check if this works
    // await activityLogger.logActivity(activityLogger.POOL_TRIP_HAS_COMPLETED)({ driver: driver, vehicle: vehicle, pool: pool, trip: tripToBeEnded })

    pool = await Pool.findById(pool._id).populate({ 
      path: 'trips',
      populate: {
        path: 'passenger',
        model: 'Users'
      } 
   }).populate('vehicleType')

    updateWallet({ id: driver._id, amount: -1 * net, ride: data.tripId })

    if (tripToBeEnded.passenger && tripToBeEnded.passenger.email) {
      try {
        const emailBody = await customerEmail({ trip: tripToBeEnded, setting })
        sendEmail(tripToBeEnded.passenger.email, 'Trip summary', emailBody)
      } catch (error) {
        console.log(error)
      }
    }

    if (activeTripsOnPoolCount === 1) { // on the last passenger
      pool.active = false;
      pool.poolEnded = false;
      pool.totalDistance = data.totalDistance

      pool.completedAt = new Date()
      pool.fare = completedTripsOnPool.map(x => x.fare).reduce((p, c) => p + c, 0) + tripToBeEnded.fare
      await pool.save()

      await updateVehicle(vehicle._id)({
        inActiveTrip: false,
      })
    }

    socket.emit('pool', pool)

    // const passengerTripCount = await Trip.countDocuments({ passenger: tripToBeEnded.passenger._id, status: TRIP_STATUS.COMPLETED })
    // for ({ every, rate } of setting.incentiveSettings) {
    //   if (passengerTripCount % every === 0) {
    //     const amount = tripToBeEnded.fare * (rate / 100)

    //     await Incentive.create({
    //       passenger: tripToBeEnded.passenger._id,
    //       ride: tripToBeEnded._id,
    //       rate,
    //       every,
    //       tripCount: passengerTripCount,
    //       passengerTripCount,
    //       fare: tripToBeEnded.fare,
    //       amount
    //     })
    //     await User.updateOne({
    //       _id: tripToBeEnded.passenger._id
    //     }, {
    //       $inc: {
    //         balance: amount
    //       }
    //     })
    //   }
    // }


    if (tripToBeEnded.passenger) {
      await updatePassenger(tripToBeEnded.passenger._id)({ inActivePool: false })

      await notifyPassenger(tripToBeEnded.passenger._id)({ title: 'Trip ended', body: 'You have arrived at your destination' })
      await emitToPassenger(tripToBeEnded.passenger._id)('trip', tripToBeEnded)
    } else {
      socket.emit('trip', tripToBeEnded)
    }


  } catch (error) {
    console.log(error)
  }
}
