const { updateTripRequest, getTripRequest } = require('../../utils/trip-request')
const { updateTripSearch, getTripSearch } = require('../../utils/ride-search')
const { sanitizeInputs } = require('../../utils/core')
const { updateVehicle } = require('../../utils/vehicle')
const { emitToPassenger, notifyPassenger } = require('../../utils/passenger')
const { emitToDriver } = require('../../utils/driver')
const { getActiveRequestsByDispatcher } = require('../../utils/trip-request')
const { emitToDispatcher, updateDispatcher } = require('../../utils/dispatcher')

const passengerTasks = require('../../../jobs/passenger')

const Ride = require('../../../models/Ride')
const Vehicle = require('../../../models/Vehicle')
const Ticket = require('../../../models/Ticket')
const REQUEST_STATUS = require('../../../constants/trip-request-statuses')
const TRIP_STATUS = require('../../../constants/trip-statuses')
const TRIP_SEARCH_STATUS = require('../../../constants/trip-search-statuses')
const Setting = require('../../../models/Setting')
const TripRequest = require('../../../models/TripRequest')

const schema = {
  type: "object",
  properties: {
    tripRequestId: { type: "string" },
    status: { type: "string" },
  },
  required: ["tripRequestId", "status"],
  additionalProperties: false
}

module.exports = async (request, driver, vehicle, socket) => {
  try {
    await sanitizeInputs(schema, request)
    // await updateTripRequest(request.tripRequestId)({ status: request.status }) // TODO: update this after refactoring

    const { status } = request

    
    if (status === REQUEST_STATUS.DECLINED) {
      const tripRequest = await getTripRequest(request.tripRequestId)
      
      // TODO: return requestCanceled in here?
      
      if (tripRequest.status !== REQUEST_STATUS.IN_REQUEST) {
        await updateVehicle(vehicle._id)({ online: true,
          // tripRequestId: null
        })
        await emitToDriver(tripRequest.driver)('requestCanceled')
        return
      }

      await updateVehicle(vehicle._id)({ online: true,
        // tripRequestId: null
      })
      await updateTripRequest(request.tripRequestId)({ status: REQUEST_STATUS.DECLINED, active: false })

      if (tripRequest.tripSearchId && tripRequest.tripSearchId === "SINGLE_DRIVER") {
        await updateDispatcher(tripRequest.dispatcher)({ tripSearchId: null })
        if (tripRequest.dispatcher) {
          emitToDispatcher(tripRequest.dispatcher)('tripSearch', {
            status: "SINGLE_DRIVER"
          })
        }
      } else if (tripRequest.tripSearchId) {
        const task = await getTripSearch(tripRequest.tripSearchId)
        const setting = await Setting.findOne()
        await passengerTasks.skipSearchingForRides(task, `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds` )
         if (tripRequest.dispatcher) {
          emitToDispatcher(tripRequest.dispatcher)('tripSearch', task)
        }
      }

      await emitToDriver(tripRequest.driver)('requestCanceled')

      if (tripRequest.dispatcher) {
        const activeRequestsDispatched = await getActiveRequestsByDispatcher(tripRequest.dispatcher)
        emitToDispatcher(tripRequest.dispatcher)('requests', activeRequestsDispatched)
      }
      // emitToPassenger(tripRequest.passenger)('requestCanceled')
    } else if (status === REQUEST_STATUS.ACCEPTED) {
      const tripRequest = await getTripRequest(request.tripRequestId)
      
      // console.log("\n\n\n\n\===============================================")
      // console.log(tripRequest.status)
      // console.log("\n\n\n\n\===============================================")
      // TODO: return requestCanceled in here?
      if (tripRequest.status !== REQUEST_STATUS.IN_REQUEST) {
        await updateVehicle(vehicle._id)({ online: true,
          // tripRequestId: null
        })
        return
      }

      await updateTripRequest(request.tripRequestId)({ status: REQUEST_STATUS.ACCEPTED, active: false })

      await updateTripSearch(tripRequest.tripSearchId)({ active: false, status: TRIP_SEARCH_STATUS.COMPLETED })
      
      if (tripRequest.tripSearchId && tripRequest.tripSearchId === "SINGLE_DRIVER") {
        
        await updateDispatcher(tripRequest.dispatcher)({ tripSearchId: null })
        if (tripRequest.dispatcher) {
          emitToDispatcher(tripRequest.dispatcher)('tripSearch', {
            status: "SINGLE_DRIVER"
          })
        }
      }
      else if (tripRequest.tripSearchId) {
        const task = await getTripSearch(tripRequest.tripSearchId)
        const activeTripRequests = await TripRequest.find({
          status: REQUEST_STATUS.IN_REQUEST,
          tripSearchId: tripRequest.tripSearchId
        })

        for (const request of activeTripRequests) {
          request.status = REQUEST_STATUS.CANCELLED
          request.active = false
          await request.save()

          await updateVehicle(tripRequest.vehicle)({ online: true, 
            // tripRequestId: null
          })
          await emitToDriver(request.driver)('status', { status: true }) // this forces the app to hide the ride search request
          await emitToDriver(request.driver)('requestCanceled') // this forces the app to hide the ride search request
        }

        await passengerTasks.stopSearchingForRides(task)

        if (tripRequest.tripSearchId) {
          task.status = TRIP_SEARCH_STATUS.COMPLETED
          await emitToDispatcher(tripRequest.dispatcher)('tripSearch', task)
        }
      }

      
      // let ticket
      // if (tripRequest.corporate && tripRequest.ticket) {
      //   ticket = await Ticket.findById(tripRequest.ticket)
      //   // ticket.active = false
      //   // ticket.save()
      // }

      if (tripRequest.dispatcher) {
        
        const activeRequestsDispatched = await getActiveRequestsByDispatcher(tripRequest.dispatcher)
        await emitToDispatcher(tripRequest.dispatcher)('requests', activeRequestsDispatched)
      
        await updateDispatcher(tripRequest.dispatcher)({ tripSearchId: null })
      }

      try {
        const ride = await Ride.create({
          passenger: tripRequest.passenger,
          driver: tripRequest.driver,
          vehicle: tripRequest.vehicle,
          dispatcher: tripRequest.dispatcher,
          type: tripRequest.type,
          corporate: tripRequest.corporate,
          schedule: tripRequest.schedule,
          bidAmount: tripRequest.bidAmount,
          pickUpAddress: tripRequest.pickUpAddress,
          orderedBy: tripRequest.orderedBy,
          dropOffAddress: tripRequest.dropOffAddress,
          vehicleType: tripRequest.vehicleType._id,
          route: tripRequest.route,
          note: tripRequest.note,
          stops: tripRequest.stops,
          ticket: tripRequest.ticket,
          status: tripRequest.schedule ? TRIP_STATUS.SCHEDULED : TRIP_STATUS.ACCEPTED, // TODO: check this field values...
          active: !tripRequest.schedule,
          createdBy: tripRequest.dispatcher ? "dispatcher" : "app"
        })

        if (ride) {
          await updateVehicle(tripRequest.vehicle)({ online: tripRequest.schedule ? true: false,
            inActiveTrip: tripRequest.schedule ? false: true,
            // tripId: !tripRequest.schedule ? ride._id : null
          })
          
          const createdRide = await Ride.findById(ride._id).populate('driver').populate('passenger').populate('vehicleType').populate('vehicle')

          if (createdRide) {
            emitToPassenger(tripRequest.passenger)('trip', createdRide)
            if (tripRequest.orderedBy) {
              emitToPassenger(tripRequest.orderedBy)('trip', createdRide)
            }
            notifyPassenger(tripRequest.passenger)({ title: 'Request accepted', body: createdRide.status === TRIP_STATUS.SCHEDULED ? 'Scheduled' : 'Driver is on the way' })

            emitToDriver(tripRequest.driver)('trip', createdRide)

          }
        }
      } catch (error) {
        console.log(error)
      }

    // } else if (status == REQUEST_STATUS.CANCELLED) {
    //   await updateTripRequest(request.tripRequestId)({ status: REQUEST_STATUS.CANCELLED, active: false })
    //   emitToDriver(tripRequest.driver)('requestCanceled') // TODO: fix the typo in the word "cancel"
    //   emitToPassenger(tripRequest.passenger)('requestCanceled')
    //   await updateVehicle(tripRequest.vehicle)({ online: true })
    }
  } catch (error) {
    console.log(error)
  }
}
