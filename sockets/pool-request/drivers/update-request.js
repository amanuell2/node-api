const { updatePoolRequest, getPoolRequest } = require('../../utils/pool-request')
const { updatePoolSearch, getPoolSearch } = require('../../utils/pool-search')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const { emitToPassenger, notifyPassenger, updatePassenger } = require('../../utils/passenger')
const { emitToDriver } = require('../../utils/driver')
const { getActiveRequestsByDispatcher } = require('../../utils/pool-request')
const { emitToDispatcher, updateDispatcher } = require('../../utils/dispatcher')
const { makeRequest } = require('../../../services/axios')

const passengerTasks = require('../../../jobs/passenger')

const Ride = require('../../../models/Ride')
const Pool = require('../../../models/Pool')
const { getPool } = require('../../utils/pool')
const Vehicle = require('../../../models/Vehicle')
const Ticket = require('../../../models/Ticket')
const REQUEST_STATUS = require('../../../constants/pool-request-statuses')
const POOL_STATUS = require('../../../constants/pool-statuses')
const POOL_SEARCH_STATUS = require('../../../constants/pool-search-statuses')
const Setting = require('../../../models/Setting')
const TRIP_TYPES = require('../../../constants/trip-types')
const PoolRequest = require('../../../models/PoolRequest')


const schema = {
  type: "object",
  properties: {
    poolRequestId: { type: "string" },
    status: { type: "string" },
  },
  required: ["poolRequestId", "status"],
  additionalProperties: false
}

module.exports = async (request, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, request)
    return
    // await updatePoolRequest(request.poolRequestId)({ status: request.status }) // TODO: update this after refactoring

    const { status } = request


    if (status === REQUEST_STATUS.DECLINED) {
      const poolRequest = await getPoolRequest(request.poolRequestId)

      // TODO: return requestCanceled in here?


      if (poolRequest.status !== REQUEST_STATUS.IN_REQUEST) {
        // await updateVehicle(vehicle._id)({ online: true,
        //   // poolRequestId: null
        // })
        if (poolRequest.type === "JOIN") {
          await emitToDriver(poolRequest.driver)('pool', await Pool.findOne({
            driver: poolRequest.driver
          }).populate({
            path: 'trips',
            populate: {
              path: 'passenger',
              model: 'Users'
            }
          }).populate('vehicleType'))
        }
        // await emitToDriver(poolRequest.driver)('requestCanceled')
        return
      }

      // await updateVehicle(vehicle._id)({ online: true,
      //   // poolRequestId: null
      // })
      await updatePoolRequest(request.poolRequestId)({ status: REQUEST_STATUS.DECLINED, active: false })

      if (poolRequest.type === "JOIN") {
        await emitToDriver(poolRequest.driver)('pool', await Pool.findOne({
          driver: poolRequest.driver
        }).populate({
          path: 'trips',
          populate: {
            path: 'passenger',
            model: 'Users'
          }
        }).populate('vehicleType'))
      }

      // if (poolRequest.poolSearchId && poolRequest.poolSearchId === "SINGLE_DRIVER") {
      //   await updateDispatcher(poolRequest.dispatcher)({ poolSearchId: null })
      //   if (poolRequest.dispatcher) {
      //     emitToDispatcher(poolRequest.dispatcher)('poolSearch', {
      //       status: "SINGLE_DRIVER"
      //     })
      //   }
      if (false) {
      } else if (poolRequest.poolSearchId) {
        const task = await getPoolSearch(poolRequest.poolSearchId)
        const setting = await Setting.findOne()
        await passengerTasks.skipSearchingForPools(task, `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`)
        // if (poolRequest.dispatcher) {
        //   emitToDispatcher(poolRequest.dispatcher)('poolSearch', task)
        // }
      }

      await emitToDriver(poolRequest.driver)('requestCanceled')

      // if (poolRequest.dispatcher) {
      //   const activeRequestsDispatched = await getActiveRequestsByDispatcher(poolRequest.dispatcher)
      //   emitToDispatcher(poolRequest.dispatcher)('requests', activeRequestsDispatched)
      // }
      // emitToPassenger(poolRequest.passenger)('requestCanceled')
    } else if (status === REQUEST_STATUS.ACCEPTED) {
      const poolRequest = await getPoolRequest(request.poolRequestId)

      // console.log("\n\n\n\n\===============================================")
      // console.log(poolRequest.status)
      // console.log("\n\n\n\n\===============================================")
      // TODO: return requestCanceled in here?
      if (poolRequest.status !== REQUEST_STATUS.IN_REQUEST) {
        // await updateVehicle(vehicle._id)({ online: true,
        //   // poolRequestId: null
        // })
        return
      }

      await updatePoolRequest(request.poolRequestId)({ status: REQUEST_STATUS.ACCEPTED, active: false })

      await updatePoolSearch(poolRequest.poolSearchId)({ active: false, status: POOL_SEARCH_STATUS.COMPLETED })

      // if (poolRequest.poolSearchId && poolRequest.poolSearchId === "SINGLE_DRIVER") {

      //   await updateDispatcher(poolRequest.dispatcher)({ poolSearchId: null })
      //   // if (poolRequest.dispatcher) {
      //   //   emitToDispatcher(poolRequest.dispatcher)('poolSearch', {
      //   //     status: "SINGLE_DRIVER"
      //   //   })
      //   // }
      // }
      if (false) { }
      else if (poolRequest.poolSearchId) {
        const task = await getPoolSearch(poolRequest.poolSearchId)
        const activePoolRequests = await PoolRequest.find({
          status: REQUEST_STATUS.IN_REQUEST,
          poolSearchId: poolRequest.poolSearchId
        })

        for (const request of activePoolRequests) {
          request.status = REQUEST_STATUS.CANCELLED
          request.active = false
          await request.save()

          // await updateVehicle(poolRequest.vehicle)({ online: true, 
          //   // poolRequestId: null
          // })
          // await emitToDriver(request.driver)('status', { status: true }) // this forces the app to hide the ride search request

          // await emitToDriver(request.driver)('requestCanceled') // this forces the app to hide the ride search request
        }

        await passengerTasks.stopSearchingForPools(task)

        // if (poolRequest.poolSearchId) {
        //   task.status = POOL_SEARCH_STATUS.COMPLETED
        //   await emitToDispatcher(poolRequest.dispatcher)('poolSearch', task)
        // }
      }


      // let ticket
      // if (poolRequest.corporate && poolRequest.ticket) {
      //   ticket = await Ticket.findById(poolRequest.ticket)
      //   // ticket.active = false
      //   // ticket.save()
      // }

      // if (poolRequest.dispatcher) {

      //   const activeRequestsDispatched = await getActiveRequestsByDispatcher(poolRequest.dispatcher)
      //   await emitToDispatcher(poolRequest.dispatcher)('requests', activeRequestsDispatched)

      //   await updateDispatcher(poolRequest.dispatcher)({ poolSearchId: null })
      // }

      try {

        if (poolRequest.type === "CREATE") {

          const pool = await Pool.create({
            pickUpAddress: poolRequest.pickUpAddress,
            dropOffAddress: poolRequest.dropOffAddress,
            vehicleType: poolRequest.vehicleType._id,
            vehicle: poolRequest.vehicle,
            driver: poolRequest.driver,
            size: poolRequest.size,
            route: poolRequest.route,
            position: {
              type: 'Point',
              coordinates: vehicle.position.coordinates
            },
            totalDistance: poolRequest.route.distance
          })

          const ride = await Ride.create({
            passenger: poolRequest.passenger,
            driver: poolRequest.driver,
            vehicle: poolRequest.vehicle,
            dispatcher: poolRequest.dispatcher,
            type: TRIP_TYPES.POOL,
            pickUpAddress: poolRequest.pickUpAddress,
            dropOffAddress: poolRequest.dropOffAddress,
            vehicleType: poolRequest.vehicleType._id,
            route: poolRequest.route,
            pool: pool._id,
            status: POOL_STATUS.ACCEPTED,
            active: true,
            createdBy: poolRequest.dispatcher ? "dispatcher" : "app"
          })

          if (ride) {
            await updateVehicle(poolRequest.vehicle)({ online: false })

            await Pool.updateOne({ _id: pool._id }, { $set: { trips: [ride._id], } })

            const createdPool = await Pool.findById(pool._id).populate({
              path: 'trips',
              populate: {
                path: 'passenger',
                model: 'Users'
              }
            }).populate('vehicleType')
            const createdRide = await Ride.findById(ride._id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

            if (createdPool) {
              emitToDriver(poolRequest.driver)('pool', createdPool)
            } else {
              console.log("FATAL ERROROROROROROR")
            }

            if (createdRide) {
              emitToPassenger(poolRequest.passenger)('trip', createdRide)
              notifyPassenger(poolRequest.passenger)({ title: 'Request accepted', body: 'Driver is on the way' })
            } else {
              console.log("FATAL ERROROROROROROR 2")
            }
          }
        } else if (poolRequest.type === "JOIN") {
          const poolToJoin = await getPool(poolRequest.pool)

          if (poolToJoin) {

            if (poolToJoin.trips.length >= poolToJoin.size) {
              return socket.emit("error", {
                message: "the pool size has reached limit"
              })
            }

            const previousRide = await Ride.findOne({
              active: true,
              pool: poolToJoin._id
            })

            if (!previousRide) {
              return socket.emit('error', {
                message: "previous pool trip does not exist or is inactive"
              })
            }

            const ride = await Ride.create({
              passenger: poolRequest.passenger,
              driver: poolRequest.driver,
              vehicle: poolRequest.vehicle,
              size: poolRequest.size,
              dispatcher: poolRequest.dispatcher,
              type: TRIP_TYPES.POOL,
              pickUpAddress: poolRequest.pickUpAddress,
              dropOffAddress: poolRequest.dropOffAddress,
              vehicleType: poolRequest.vehicleType._id,
              route: poolRequest.route,
              status: POOL_STATUS.ACCEPTED,
              active: true,
              pool: poolToJoin._id,
              createdBy: poolRequest.dispatcher ? "dispatcher" : "app"
            })


            if (ride) {
              await updateVehicle(poolRequest.vehicle)({
                online: false,
                // poolId: !poolRequest.schedule ? ride._id : null
              })

              const currentPosition = {
                lat: vehicle.position.coordinates[1],
                long: vehicle.position.coordinates[0],
              }

              const setting = await Setting.findOne({})

              Promise.all([
                makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${currentPosition.lat},${currentPosition.long}&destination=${previousRide.dropOffAddress.lat},${previousRide.dropOffAddress.long}&waypoints=${poolRequest.pickUpAddress.lat},${poolRequest.pickUpAddress.long}|${poolRequest.dropOffAddress.lat},${poolRequest.dropOffAddress.long}&key=${setting.mapKey}` }),
                makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${currentPosition.lat},${currentPosition.long}&destination=${poolRequest.dropOffAddress.lat},${poolRequest.dropOffAddress.long}&waypoints=${poolRequest.pickUpAddress.lat},${poolRequest.pickUpAddress.long}|${previousRide.dropOffAddress.lat},${previousRide.dropOffAddress.long}&key=${setting.mapKey}` }),
              ])
              .then(async ([route1, route2]) => {

                if (route1.data.status == "OK" && route2.data.status == "OK") {
                  const distance1 = (route1.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)
                  const distance2 = (route2.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)

                  const routeRes = distance1 < distance2 ?
                    await makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${previousRide.pickUpAddress.lat},${previousRide.pickUpAddress.long}&destination=${previousRide.dropOffAddress.lat},${previousRide.dropOffAddress.long}&waypoints=${currentPosition.lat},${currentPosition.long}|${poolRequest.pickUpAddress.lat},${poolRequest.pickUpAddress.long}|${poolRequest.dropOffAddress.lat},${poolRequest.dropOffAddress.long}&key=${setting.mapKey}` }) :
                    await makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${previousRide.pickUpAddress.lat},${previousRide.pickUpAddress.long}&destination=${poolRequest.dropOffAddress.lat},${poolRequest.dropOffAddress.long}&waypoints=${currentPosition.lat},${currentPosition.long}|${poolRequest.pickUpAddress.lat},${poolRequest.pickUpAddress.long}|${previousRide.dropOffAddress.lat},${previousRide.dropOffAddress.long}&key=${setting.mapKey}` })

                  const polyline = routeRes.data.routes[0].overview_polyline.points;
                  const distance = (routeRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)
                  const duration = (routeRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.duration.value,0)

                  poolToJoin.route = {
                    distance,
                    duration,
                    polyline,
                  }
                }

                poolToJoin.trips.push(ride._id)
                poolToJoin.totalDistance = poolToJoin.route.distance
                await poolToJoin.save()

                await updatePassenger(poolRequest.passenger)({ inActivePool: true, poolId: request.poolId })

                const updatedPool = await Pool.findById(poolToJoin._id).populate({
                  path: 'trips',
                  populate: {
                    path: 'passenger',
                    model: 'Users'
                  }
                }).populate('vehicleType')

                if (updatedPool) {
                  emitToPassenger(poolRequest.passenger)('trip', await Ride.findById(ride._id).populate('vehicleType').populate('driver').populate('vehicle'))
                  notifyPassenger(poolRequest.passenger)({ title: 'Request accepted', body: 'Driver is on the way' })

                  emitToDriver(poolRequest.driver)('pool', updatedPool)

                }
              })
            }
          } else {
            socket.emit('error', {
              message: "the pool you are trying to join couldn't be found"
            })
          }

        }

      } catch (error) {
        console.log(error)
      }

      // } else if (status == REQUEST_STATUS.CANCELLED) {
      //   await updatePoolRequest(request.poolRequestId)({ status: REQUEST_STATUS.CANCELLED, active: false })
      //   emitToDriver(poolRequest.driver)('requestCanceled') // TODO: fix the typo in the word "cancel"
      //   emitToPassenger(poolRequest.passenger)('requestCanceled')
      //   await updateVehicle(poolRequest.vehicle)({ online: true })
    }
  } catch (error) {
    console.log(error)
  }
}